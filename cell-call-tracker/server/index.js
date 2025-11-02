import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import fetch from 'node-fetch';
import os from 'os';
import { execFile } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, 'data');
const STAFF_FILE = path.join(DATA_DIR, 'staff.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');
const RECORDS_FILE = path.join(DATA_DIR, 'records.json');

const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } };
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ---------- Staff ----------
app.get('/api/staff', (_req, res) => res.json(readJson(STAFF_FILE, [])));

app.post('/api/staff', (req, res) => {
  const { name, role, by } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const staff = readJson(STAFF_FILE, []);
  const nextId = (staff.length ? Math.max(...staff.map(s => Number(s.id) || 0)) : 0) + 1;
  const member = { id: nextId, name, role: role || '' };
  staff.push(member);
  writeJson(STAFF_FILE, staff);

  const audit = readJson(AUDIT_FILE, []);
  audit.push({ id: nanoid(10), action: 'add', target: 'staff', name, role: role || '', by: by || 'TEMP_NO_AUTH', at: new Date().toISOString() });
  writeJson(AUDIT_FILE, audit);

  res.json(member);
});

app.delete('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const { by } = req.body || {};
  const staff = readJson(STAFF_FILE, []);
  const idx = staff.findIndex(s => String(s.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const [removed] = staff.splice(idx, 1);
  writeJson(STAFF_FILE, staff);

  const audit = readJson(AUDIT_FILE, []);
  audit.push({ id: nanoid(10), action: 'remove', target: 'staff', name: removed.name, role: removed.role || '', by: by || 'TEMP_NO_AUTH', at: new Date().toISOString() });
  writeJson(AUDIT_FILE, audit);
  res.json({ ok: true });
});

// ---------- Records ----------
app.post('/api/records', (req, res) => {
  const b = req.body || {};
  if (!b.incidentId) return res.status(400).json({ error: 'incidentId required' });
  if (!b.dojReportNumber) return res.status(400).json({ error: 'dojReportNumber required' });
  if (b.leadingId === undefined || b.leadingId === null) return res.status(400).json({ error: 'leadingId required' });

  const rec = {
    id: nanoid(12),
    date: b.date ? new Date(b.date).toISOString() : new Date().toISOString(),
    incidentId: String(b.incidentId),
    dojReportNumber: String(b.dojReportNumber),
    leadingId: Number(b.leadingId),
    attorneyObservers: Array.isArray(b.attorneyObservers) ? b.attorneyObservers.map(Number) : [],
    paralegalObservers: Array.isArray(b.paralegalObservers) ? b.paralegalObservers.map(Number) : [],
    verdict: b.verdict,
    benchVerdictNumber: b.verdict === 'BENCH_REQUEST' ? (b.benchVerdictNumber || null) : null,
    chargesRemoved: !!b.chargesRemoved,
    chargesReplaced: !!b.chargesRemoved && !!b.chargesReplaced,
    fine: b.fine === null || b.fine === '' || b.fine === undefined ? null : Number(b.fine),
    sentenceMonths: b.sentenceMonths === null || b.sentenceMonths === '' || b.sentenceMonths === undefined ? null : Number(b.sentenceMonths),
    cellCallType: b.cellCallType,
    notes: b.notes || '',
    loggedBy: b.by || 'TEMP_NO_AUTH'
  };

  const records = readJson(RECORDS_FILE, []);
  records.push(rec);
  writeJson(RECORDS_FILE, records);
  res.json(rec);
});

// Filter only LEADING staff
app.get('/api/records', (req, res) => {
  const q = req.query || {};
  const from = q.from ? new Date(q.from) : null;
  const to = q.to ? new Date(q.to) : null;
  const staffId = q.staffId ? String(q.staffId) : '';
  const cellCallType = q.cellCallType || '';

  const rows = readJson(RECORDS_FILE, []).filter(r => {
    const t = new Date(r.date);
    if (from && t < from) return false;
    if (to && t > to) return false;
    if (staffId && String(r.leadingId) !== staffId) return false;
    if (cellCallType && r.cellCallType !== cellCallType) return false;
    return true;
  });
  res.json(rows);
});

// OCR worker - lazy init and reuse
let _worker = null;
async function getWorker(){
  if (_worker) return _worker;
  // dynamically import tesseract only when needed (avoids WASM load at server start)
  const { createWorker } = await import('tesseract.js');
  const worker = createWorker({ logger: m => {/* optional logging */} });
  await worker.load();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  _worker = worker;
  return _worker;
}

// Real image analysis endpoint: accepts JSON { image: dataUrl }
app.post('/api/analyze', express.json({ limit: '12mb' }), async (req, res) => {
  const body = req.body || {};
  const dataUrl = body.image || '';
  if (!dataUrl) return res.status(400).json({ error: 'image required' });

  try {
    // parse data URL
    const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) return res.status(400).json({ error: 'invalid image data' });
    const mime = m[1];
    const base64 = m[2];

    const apiKey = process.env.OCR_SPACE_API_KEY;
    let text = '';

    if (apiKey) {
      // Use OCR.space API (proxy) when API key is configured
      const params = new URLSearchParams();
      // OCR.space expects the data URL form 'data:image/...;base64,...'
      params.append('apikey', apiKey);
      params.append('base64Image', `data:${mime};base64,${base64}`);
      params.append('language', 'eng');
      params.append('isOverlayRequired', 'false');

      const r = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: params });
      const j = await r.json();
      if (!j || !j.ParsedResults || !j.ParsedResults[0]) {
        console.error('ocr.space no parsed results', j);
        return res.status(500).json({ error: 'ocr failed', raw: j });
      }
      text = j.ParsedResults.map(p => p.ParsedText).join('\n');
    } else {
      // Prefer system tesseract CLI if available (writes a temp file and calls tesseract)
      const buffer = Buffer.from(base64, 'base64');
      const tmpPath = path.join(os.tmpdir(), `cct-ocr-${Date.now()}-${Math.random().toString(36).slice(2,8)}.png`);
      try {
        fs.writeFileSync(tmpPath, buffer);
        try {
          // execFile will reject if tesseract is not found or fails
          const stdout = await new Promise((resolve, reject) => {
            execFile('tesseract', [tmpPath, 'stdout', '-l', 'eng'], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
              if (err) return reject(err);
              resolve(stdout);
            });
          });
          text = String(stdout || '');
        } catch (cliErr) {
          // If system tesseract isn't available or fails, fall back to tesseract.js worker
          console.warn('system tesseract failed, falling back to tesseract.js:', String(cliErr));
          const worker = await getWorker();
          const result = await worker.recognize(buffer);
          text = (result && result.data && result.data.text) ? result.data.text : '';
        }
      } finally {
        try { fs.unlinkSync(tmpPath); } catch (e) { /* ignore */ }
      }
    }

    // heuristics: find 6-digit DOJ and 6-digit incident ID, date formats, and leading attorney by name
    const dojMatch = text.match(/\b\d{6}\b/);
    const doj = dojMatch ? dojMatch[0] : null;
    const incMatch = text.match(/\b[A-Z0-9]{6}\b/i);
    const incident = incMatch ? incMatch[0] : null;

    // date: look for ISO yyyy-mm-dd or mm/dd/yyyy
    let dateMatch = text.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (!dateMatch) dateMatch = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
    let date = dateMatch ? dateMatch[0] : new Date().toISOString().slice(0,10);
    if (date && date.includes('/')) {
      // normalize mm/dd/yyyy -> yyyy-mm-dd
      const parts = date.split('/').map(p=>p.padStart(2,'0'));
      if (parts.length === 3) date = `${parts[2]}-${parts[0]}-${parts[1]}`;
    }

    const staff = readJson(STAFF_FILE, []);
    let leadingId = null;
    for (const s of staff){
      if (!s || !s.name) continue;
      const name = String(s.name).split(' ')[0];
      if (name && text.toLowerCase().includes(name.toLowerCase())){ leadingId = s.id; break; }
    }

    // return extracted text as notes plus parsed fields
    return res.json({ dojReportNumber: doj, incidentId: incident, date, leadingId, notes: String(text).slice(0,2000) });
  } catch (err) {
    console.error('analyze error', err);
    return res.status(500).json({ error: 'analysis failed', details: String(err) });
  }
});

// Delete record by ID
app.delete('/api/records/:id', (req, res) => {
  const { id } = req.params;
  const records = readJson(RECORDS_FILE, []);
  const idx = records.findIndex(r => String(r.id) === id);
  if (idx === -1) return res.status(404).json({ error: 'Record not found' });
  records.splice(idx, 1);
  writeJson(RECORDS_FILE, records);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

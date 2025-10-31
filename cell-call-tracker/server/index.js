import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';

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

// Simple image analysis mock endpoint. Accepts JSON { image: dataUrl }
app.post('/api/analyze', express.json(), (req, res) => {
  const body = req.body || {};
  const img = body.image || '';
  if (!img) return res.status(400).json({ error: 'image required' });

  // Minimal mock parsing: return fixed example values and attempt to pick a leadingId from staff
  const staff = readJson(STAFF_FILE, []);
  const leadingId = staff.length ? staff[0].id : null;

  // Example deterministic mock: use timestamp digits for DOJ/incident to vary per request
  const ts = Date.now().toString();
  const doj = ts.slice(-6);
  const inc = ts.slice(-12,-6) || '000000';

  return res.json({ dojReportNumber: doj, incidentId: inc, date: new Date().toISOString().slice(0,10), leadingId, notes: 'Mock analysis — please verify.' });
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

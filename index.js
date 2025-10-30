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

const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } };
const writeJson = (p, data) => fs.writeFileSync(p, JSON.stringify(data, null, 2));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Health
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// -------- Staff: list
app.get('/api/staff', (_req, res) => {
  res.json(readJson(STAFF_FILE, []));
});

// -------- Staff: add (temporary 'by' field until auth is added)
// body: { name, role, by }
app.post('/api/staff', (req, res) => {
  const { name, role, by } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const staff = readJson(STAFF_FILE, []);
  const nextId = (staff.length ? Math.max(...staff.map(s => Number(s.id) || 0)) : 0) + 1; // numeric IDs
  const member = { id: nextId, name, role: role || '' };

  staff.push(member);
  writeJson(STAFF_FILE, staff);

  const audit = readJson(AUDIT_FILE, []);
  audit.push({
    id: nanoid(10),
    action: 'add',
    target: 'staff',
    name,
    role: role || '',
    by: by || 'TEMP_NO_AUTH',
    at: new Date().toISOString()
  });
  writeJson(AUDIT_FILE, audit);

  res.json(member);
});

// -------- Staff: remove (temporary 'by' field until auth is added)
// body: { by }
app.delete('/api/staff/:id', (req, res) => {
  const { id } = req.params;
  const { by } = req.body || {};
  const staff = readJson(STAFF_FILE, []);
  const idx = staff.findIndex(s => String(s.id) === String(id));
  if (idx === -1) return res.status(404).json({ error: 'not found' });

  const [removed] = staff.splice(idx, 1);
  writeJson(STAFF_FILE, staff);

  const audit = readJson(AUDIT_FILE, []);
  audit.push({
    id: nanoid(10),
    action: 'remove',
    target: 'staff',
    name: removed.name,
    role: removed.role || '',
    by: by || 'TEMP_NO_AUTH',
    at: new Date().toISOString()
  });
  writeJson(AUDIT_FILE, audit);

  res.json({ ok: true });
});

// -------- Audit: list
app.get('/api/audit', (_req, res) => {
  res.json(readJson(AUDIT_FILE, []));
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

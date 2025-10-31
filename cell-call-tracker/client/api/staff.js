export default async function handler(req, res) {
  try {
    const mod = await import('../../api/staff.js')
    return mod.default(req, res)
  } catch (err) {
    console.error('proxy staff error', err)
    res.status(500).json({ error: String(err).slice(0,1000) })
  }
}
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const STAFF_PATH = path.join(__dirname, '..', 'data', 'staff.json');

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).end('Method Not Allowed');
    }
    const raw = await fs.readFile(STAFF_PATH, 'utf8');
    const staff = JSON.parse(raw);
    const normalized = Array.isArray(staff) ? staff.map(s => ({
      id: Number(s.id),
      name: s.name,
      role: s.role || ''
    })) : [];
    return res.status(200).json(normalized);
  } catch (e) {
    console.error(e);
    return res.status(200).json([]); // safe fallback
  }
}

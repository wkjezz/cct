import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const RECORDS_PATH = path.join(__dirname, '..', 'data', 'records.json');

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).end('Method Not Allowed');
    }

    const raw = await fs.readFile(RECORDS_PATH, 'utf8');
    let rows = JSON.parse(raw) || [];

    // Filters: from, to, staffId (leading only), cellCallType, incidentType
    const q = req.query ?? {};
    const from = q.from ? new Date(q.from) : null;
    const to   = q.to   ? new Date(q.to)   : null;
    const staffId      = q.staffId ? String(q.staffId) : '';
    const cellCallType = q.cellCallType || '';
    const incidentType = q.incidentType || '';

    rows = rows.filter(r => {
      const t = new Date(r.date);
      if (from && t < from) return false;
      if (to   && t > to)   return false;
      if (staffId && String(r.leadingId) !== staffId) return false;
      if (cellCallType && r.cellCallType !== cellCallType) return false;
      if (incidentType && r.incidentType !== incidentType) return false;
      return true;
    });

    return res.status(200).json(rows);
  } catch (e) {
    console.error(e);
    return res.status(200).json([]); // safe fallback
  }
}

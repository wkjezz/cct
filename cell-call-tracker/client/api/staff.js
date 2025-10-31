import fs from 'fs'
import path from 'path'

export default function handler(_req, res){
  try{
    const dataPath = path.join(process.cwd(), 'data', 'staff.json')
    const raw = fs.readFileSync(dataPath, 'utf-8')
    const staff = JSON.parse(raw)
    return res.status(200).json(staff)
  }catch(err){
    console.error('staff handler error', err)
    return res.status(500).json({ error: String(err).slice(0,1000) })
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

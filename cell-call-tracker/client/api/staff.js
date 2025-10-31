// Inline staff list to avoid FS/import issues in serverless runtime when project root is client
const STAFF = [
  { "id": 1, "name": "Alora Vaughn", "role": "Chief of Public Defense" },
  { "id": 2, "name": "Lucy Greene", "role": "Deputy Chief of Public Defense" },
  { "id": 3, "name": "Remy Vaughn", "role": "Lead Public Defender" },
  { "id": 4, "name": "Colin Burns", "role": "Lead Public Defender" },
  { "id": 5, "name": "Gabriel Specter", "role": "Senior Public Defender" },
  { "id": 6, "name": "Cora Lomaine-Stark", "role": "Public Defender" },
  { "id": 7, "name": "Jon Harvey", "role": "Junior Public Defender" },
  { "id": 8, "name": "Vanessa Hurgs", "role": "Junior Public Defender" },
  { "id": 9, "name": "Jeb Mayberry", "role": "Junior Public Defender" },
  { "id": 10, "name": "Aliera Swift", "role": "Junior Public Defender" },
  { "id": 11, "name": "Benjamin York", "role": "Junior Public Defender" },
  { "id": 12, "name": "Gabriel Michaels", "role": "Paralegal" },
  { "id": 13, "name": "Azule Juarez", "role": "Paralegal" }
]

export default function handler(_req, res){
  res.status(200).json(STAFF)
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

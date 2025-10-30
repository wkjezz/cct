// /api/staff.js
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DATA_DIR = path.join(__dirname, '..', 'data')
const STAFF_FILE = path.join(DATA_DIR, 'staff.json')

export default async function handler(_req, res) {
  try {
    const raw = fs.readFileSync(STAFF_FILE, 'utf-8')
    const staff = JSON.parse(raw)
    res.status(200).json(staff)
  } catch (e) {
    console.error(e)
    res.status(200).json([]) // safe empty
  }
}

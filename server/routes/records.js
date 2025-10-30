import express from 'express'
import { kv } from '@vercel/kv'

const router = express.Router()

// GET /api/records
router.get('/', async (req, res) => {
  try {
    const ids = await kv.zrange('records:index', 0, -1, { rev: true })
    const records = await Promise.all(ids.map(id => kv.hgetall(`record:${id}`)))
    res.json(records.filter(Boolean))
  } catch (err) {
    console.error('GET /api/records failed:', err)
    res.status(500).json({ error: 'Failed to fetch records' })
  }
})

// POST /api/records
router.post('/', async (req, res) => {
  try {
    const record = req.body
    if (!record.incidentId) return res.status(400).json({ error: 'incidentId required' })
    if (!record.dojReportNumber) return res.status(400).json({ error: 'dojReportNumber required' })

    const id = record.id || crypto.randomUUID()
    const now = new Date().toISOString()
    const full = { ...record, id, createdAt: record.createdAt || now }

    await kv.hset(`record:${id}`, full)
    await kv.zadd('records:index', { score: Date.parse(full.createdAt), member: id })
    res.json({ ok: true, id })
  } catch (err) {
    console.error('POST /api/records failed:', err)
    res.status(500).json({ error: 'Failed to save record' })
  }
})

export default router

// /api/records.js  (repo root)
import { kv } from '@vercel/kv'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Newest first
      const ids = await kv.zrange('records:index', 0, -1, { rev: true })
      const records = await Promise.all(ids.map(id => kv.hgetall(`record:${id}`)))
      return res.status(200).json(records.filter(Boolean))
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

      if (!body.incidentId)      return res.status(400).json({ error: 'incidentId required' })
      if (!body.dojReportNumber) return res.status(400).json({ error: 'dojReportNumber required' })
      if (body.leadingId === undefined || body.leadingId === null) {
        return res.status(400).json({ error: 'leadingId required' })
      }

      const id = body.id || randomUUID()
      const createdAt = body.createdAt || new Date().toISOString()
      const record = { ...body, id, createdAt }

      await kv.hset(`record:${id}`, record)
      await kv.zadd('records:index', { score: Date.parse(createdAt), member: id })

      return res.status(200).json({ ok: true, id })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).end('Method Not Allowed')
  } catch (err) {
    console.error('API /api/records error:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

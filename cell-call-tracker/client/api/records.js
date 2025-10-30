import { kv } from '@vercel/kv'
import { randomUUID } from 'crypto'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // newest first
      const ids = await kv.zrange('records:index', 0, -1, { rev: true })
      const records = await Promise.all(ids.map(id => kv.hgetall(`record:${id}`)))
      return res.status(200).json(records.filter(Boolean))
    }

    if (req.method === 'POST') {
      // Vercel Node functions may give string bodies; normalize it
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

      if (!b.incidentId) return res.status(400).json({ error: 'incidentId required' })
      if (!b.dojReportNumber) return res.status(400).json({ error: 'dojReportNumber required' })
      if (b.leadingId === undefined || b.leadingId === null) {
        return res.status(400).json({ error: 'leadingId required' })
      }

      const id = b.id || randomUUID()
      const createdAt = b.createdAt || new Date().toISOString()
      const record = { ...b, id, createdAt }

      // store record
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

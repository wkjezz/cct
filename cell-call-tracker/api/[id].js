// /api/records/[id].js
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    const { id } = req.query || {}
    if (!id) return res.status(400).json({ error: 'id required' })

    if (req.method === 'DELETE') {
      await kv.del(`record:${id}`)
      await kv.zrem('records:byCreated', id)
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'DELETE')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('delete record error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

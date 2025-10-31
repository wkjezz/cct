// /api/records.js
import { kv } from '@vercel/kv'
import { nanoid } from 'nanoid'

/**
 * We store each record at key:   record:<id>   => JSON
 * And keep a sorted set index:   records:byCreated  (score = ms timestamp, member = <id>)
 */

function parseMs(v, fallback) {
  const n = Date.parse(v)
  return Number.isFinite(n) ? n : fallback
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Filters (all optional)
  const { from, to, staffId, cellCallType, verdict } = req.query

      const fromMs = from ? parseMs(from, 0) : 0
      const toMs = to ? parseMs(to, Date.now() + 365 * 24 * 3600 * 1000) : Date.now() + 365 * 24 * 3600 * 1000

      // Pull IDs in range via the sorted-set index
      const ids = await kv.zrange('records:byCreated', fromMs, toMs, { byScore: true })
      if (!ids || ids.length === 0) return res.status(200).json([])

      // Fetch all records
      const keys = ids.map(id => `record:${id}`)
      const items = await kv.mget(keys)

      // Filter in-memory for the other filters
      const rows = (items || []).filter(Boolean).filter(r => {
        if (staffId && String(r.leadingId) !== String(staffId)) return false
        if (cellCallType && r.cellCallType !== cellCallType) return false
        if (verdict && r.verdict !== verdict) return false
        return true
      })

      // Sort newest first by createdAt/date just in case
      rows.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
      return res.status(200).json(rows)
    }

    if (req.method === 'POST') {
      const b = req.body || {}
      // very light validation (your client already validates too)
      if (!b.incidentId) return res.status(400).json({ error: 'incidentId required' })
      if (!b.dojReportNumber) return res.status(400).json({ error: 'dojReportNumber required' })
      if (b.leadingId === undefined || b.leadingId === null) return res.status(400).json({ error: 'leadingId required' })

      const nowIso = new Date().toISOString()

      // Allow overwriting if an 'id' was provided (e.g. your "overwrite" flow),
      // otherwise generate a new one.
      const id = b.id || nanoid(12)

      const rec = {
        id,
        date: b.date ? new Date(b.date).toISOString() : nowIso,
        createdAt: b.createdAt || nowIso,
        updatedAt: nowIso,

        incidentId: String(b.incidentId),
        dojReportNumber: String(b.dojReportNumber),
        leadingId: Number(b.leadingId),

        supervising: Array.isArray(b.supervising) ? b.supervising.map(x => (x === 'judiciary' ? 'judiciary' : Number(x))) : [],
        attorneyObservers: Array.isArray(b.attorneyObservers) ? b.attorneyObservers.map(Number) : [],
        paralegalObservers: Array.isArray(b.paralegalObservers) ? b.paralegalObservers.map(Number) : [],

        verdict: b.verdict,
        benchVerdictNumber: b.verdict === 'BENCH_REQUEST' ? (b.benchVerdictNumber || null) : null,

        chargesRemoved: !!b.chargesRemoved,
        chargesReplaced: !!b.chargesRemoved && !!b.chargesReplaced,

        fine: b.fine === null || b.fine === '' || b.fine === undefined ? null : Number(b.fine),
        sentenceMonths: b.sentenceMonths === null || b.sentenceMonths === '' || b.sentenceMonths === undefined ? null : Number(b.sentenceMonths),

        cellCallType: b.cellCallType,
        notes: b.notes || '',
        by: b.by || b.loggedBy || 'unknown',
      }

      // Save JSON
      await kv.set(`record:${id}`, rec)

      // Update sorted-set index by created time
      const score = Date.parse(rec.createdAt || rec.date) || Date.now()
      await kv.zadd('records:byCreated', { score, member: id })

      return res.status(200).json(rec)
    }

    res.setHeader('Allow', 'GET,POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('records handler error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

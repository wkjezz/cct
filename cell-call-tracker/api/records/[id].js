// /api/records/[id].js
import { kv } from '@vercel/kv'

export default async function handler(req, res) {
  try {
    const { id } = req.query || {}
    if (!id) return res.status(400).json({ error: 'id required' })

    // Require editor for DELETE/PUT
    if (req.method !== 'GET') {
      try {
        const { getUserFromReq } = await import('../_auth.js')
        const user = getUserFromReq(req)
        if (!user || !user.isEditor) return res.status(403).json({ error: 'Forbidden' })
      } catch (e) {
        console.error('auth check failed', e)
        return res.status(500).json({ error: 'Auth check failed' })
      }
    }

    if (req.method === 'DELETE') {
      await kv.del(`record:${id}`)
      await kv.zrem('records:byCreated', id)
      return res.status(200).json({ ok: true })
    }

    // Support updating a record via PUT
    if (req.method === 'PUT') {
      const b = req.body || {}
      // Fetch existing record (optional)
      const existing = await kv.get(`record:${id}`)

      const nowIso = new Date().toISOString()
      // Build updated record, preserving createdAt when present
      const rec = Object.assign({}, existing || {}, {
        id,
        date: b.date ? new Date(b.date).toISOString() : (existing?.date || nowIso),
        createdAt: existing?.createdAt || b.createdAt || nowIso,
        updatedAt: nowIso,

        incidentId: b.incidentId !== undefined ? String(b.incidentId) : existing?.incidentId,
        dojReportNumber: b.dojReportNumber !== undefined ? String(b.dojReportNumber) : existing?.dojReportNumber,
        leadingId: b.leadingId !== undefined ? Number(b.leadingId) : existing?.leadingId,

        supervising: Array.isArray(b.supervising) ? b.supervising.map(x => (x === 'judiciary' ? 'judiciary' : Number(x))) : (existing?.supervising || []),
        attorneyObservers: Array.isArray(b.attorneyObservers) ? b.attorneyObservers.map(Number) : (existing?.attorneyObservers || []),
        paralegalObservers: Array.isArray(b.paralegalObservers) ? b.paralegalObservers.map(Number) : (existing?.paralegalObservers || []),

        verdict: b.verdict !== undefined ? b.verdict : existing?.verdict,
        benchVerdictNumber: b.verdict === 'BENCH_REQUEST' ? (b.benchVerdictNumber || existing?.benchVerdictNumber || null) : null,

        chargesRemoved: b.chargesRemoved !== undefined ? !!b.chargesRemoved : !!existing?.chargesRemoved,
        chargesReplaced: b.chargesReplaced !== undefined ? !!b.chargesReplaced : !!existing?.chargesReplaced,

        fine: b.fine === undefined ? existing?.fine : (b.fine === null || b.fine === '' ? null : Number(b.fine)),
        sentenceMonths: b.sentenceMonths === undefined ? existing?.sentenceMonths : (b.sentenceMonths === null || b.sentenceMonths === '' ? null : Number(b.sentenceMonths)),

        cellCallType: b.cellCallType !== undefined ? b.cellCallType : existing?.cellCallType,
        notes: b.notes !== undefined ? b.notes : existing?.notes,
        by: b.by !== undefined ? b.by : existing?.by || 'unknown'
      })

      // Save
      await kv.set(`record:${id}`, rec)
      // Update sorted-set index (use createdAt if present)
      const score = Date.parse(rec.createdAt || rec.date) || Date.now()
      await kv.zadd('records:byCreated', { score, member: id })

      return res.status(200).json(rec)
    }

    res.setHeader('Allow', 'DELETE, PUT')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('delete record error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

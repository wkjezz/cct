// client/api/records/[id].js
import { kv } from '@vercel/kv'

const recKey = (id) => `record:${id}`
const dojMapKey = (doj) => `recordByDoj:${String(doj)}`
const indexKey = 'records:index'

async function getById(id){ if(!id) return null; return await kv.get(recKey(id)) }

export default async function handler(req, res){
  try{
    // Allow both query id and path id
    const url = new URL(req.url, 'http://localhost')
    const m = url.pathname.match(/\/api\/records\/([^/]+)/)
    const id = (m && m[1]) || url.searchParams.get('id') || req.query?.id
    if(!id) return res.status(400).json({ error: 'id required' })

    if(req.method === 'DELETE'){
      const rec = await getById(id)
      await kv.del(recKey(id))
      await kv.zrem(indexKey, id)
      if(rec?.dojReportNumber){
        const mapped = await kv.get(dojMapKey(rec.dojReportNumber))
        if(mapped === id) await kv.del(dojMapKey(rec.dojReportNumber))
      }
      return res.status(200).json({ ok: true })
    }

    if(req.method === 'PUT'){
      const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body || {})
      const existing = await getById(id)
      if(!existing) return res.status(404).json({ error: 'Not found' })
      const updatedAt = new Date().toISOString()
      const next = {
        ...existing,
        ...body,
        id,
        createdAt: existing.createdAt,
        updatedAt,
        incidentId: body.incidentId !== undefined ? String(body.incidentId) : existing.incidentId,
        dojReportNumber: body.dojReportNumber !== undefined ? String(body.dojReportNumber) : existing.dojReportNumber,
        leadingId: body.leadingId !== undefined ? Number(body.leadingId) : existing.leadingId,
        fine: body.fine === '' ? null : (body.fine !== undefined ? Number(body.fine) : existing.fine),
        sentenceMonths: body.sentenceMonths === '' ? null : (body.sentenceMonths !== undefined ? Number(body.sentenceMonths) : existing.sentenceMonths),
      }

      if(next.dojReportNumber !== existing.dojReportNumber){
        if(existing.dojReportNumber) await kv.del(dojMapKey(existing.dojReportNumber))
        await kv.set(dojMapKey(next.dojReportNumber), id)
      }

      await kv.set(recKey(id), next)
      return res.status(200).json(next)
    }

    res.setHeader('Allow','DELETE,PUT')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }catch(err){
    console.error('records/[id] error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

import fs from 'fs'
import path from 'path'

function parseMs(v, fallback){
  const n = Date.parse(v)
  return Number.isFinite(n) ? n : fallback
}

export default function handler(req, res){
  try{
    if(req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' })

    const { from, to } = req.query || {}
    const dataPath = path.join(process.cwd(), 'data', 'records.json')
    const raw = fs.readFileSync(dataPath, 'utf-8')
    const rows = JSON.parse(raw || '[]')

    const fromMs = from ? parseMs(from, 0) : 0
    const toMs = to ? parseMs(to, Date.now()) : Date.now()

    const filtered = rows.filter(r => {
      const t = Date.parse(r.createdAt || r.date) || 0
      return t >= fromMs && t <= toMs
    })

    // sort newest first
    filtered.sort((a,b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))
    return res.status(200).json(filtered)
  }catch(err){
    console.error('records handler error', err)
    return res.status(500).json({ error: String(err).slice(0,1000) })
  }
}
// client/pages/api/records.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

function ok(res, data) { return res.status(200).json(data); }
function bad(res, msg, code = 400) { return res.status(code).json({ error: msg }); }

function getIdFromReq(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
    // allow /api/records/<id>
    const m = url.pathname.match(/\/api\/records\/([^/]+)/);
    if (m && m[1]) return m[1];
    return url.searchParams.get('id') || req.query?.id || null;
  } catch {
    return req.query?.id || null;
  }
}

function parseISOorNull(s) {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t) : null;
}

// --- Keys & helpers ---
const recKey = (id) => `record:${id}`;
const dojMapKey = (doj) => `recordByDoj:${String(doj)}`;   // DOJ# -> id
const indexKey = 'records:index';                          // zset newest by createdAt

async function getById(id) {
  if (!id) return null;
  return await kv.get(recKey(id));
}

async function getByDoj(doj) {
  if (!doj) return null;
  const id = await kv.get(dojMapKey(doj));
  if (!id) return null;
  return await kv.get(recKey(id));
}

export default async function handler(req, res) {
  // CORS (safe same-origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---------- GET ----------
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const id = getIdFromReq(req);
      const doj = url.searchParams.get('doj');

      // GET by id
      if (id) {
        const rec = await getById(id);
        if (!rec) return bad(res, 'Not found', 404);
        return ok(res, rec);
      }

      // GET by DOJ mapping
      if (doj) {
        const rec = await getByDoj(doj);
        // return null to keep frontend simple
        return ok(res, rec || null);
      }

      // List with filters (default)
      const from = parseISOorNull(url.searchParams.get('from'));
      const to = parseISOorNull(url.searchParams.get('to'));
         const staffId = url.searchParams.get('staffId') || '';
         const cellCallType = url.searchParams.get('cellCallType') || '';
         const verdict = url.searchParams.get('verdict') || '';

      // newest first
      const ids = await kv.zrange(indexKey, 0, -1, { rev: true });
      if (!ids || ids.length === 0) return ok(res, []);

      const recKeys = ids.map(recKey);
      const list = (await kv.mget(recKeys)).filter(Boolean);

      const filtered = list.filter(r => {
        const ts = r.createdAt || r.date;
        const t = Date.parse(ts);
        if (from && (!Number.isFinite(t) || t < from.getTime())) return false;
        if (to && (!Number.isFinite(t) || t > to.getTime())) return false;
        if (staffId && String(r.leadingId) !== String(staffId)) return false;
        if (cellCallType && r.cellCallType !== cellCallType) return false;
           if (verdict && r.verdict !== verdict) return false;
        return true;
      });

      return ok(res, filtered);
    } catch (e) {
      console.error('GET /api/records error', e);
      return bad(res, 'Failed to load records', 500);
    }
  }

  // Parse body once for write methods
  const body = (() => {
    try {
      return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    } catch {
      return {};
    }
  })();

  // ---------- POST (create) ----------
  if (req.method === 'POST') {
    try {
      if (!body.incidentId) return bad(res, 'incidentId required');
      if (!body.dojReportNumber) return bad(res, 'dojReportNumber required');
      if (body.leadingId === undefined || body.leadingId === null) return bad(res, 'leadingId required');

      const nowISO = new Date().toISOString();

      // duplicate handling via mapping
      const existingId = await kv.get(dojMapKey(body.dojReportNumber));
      const overwrite = String(new URL(req.url, 'http://localhost').searchParams.get('overwrite') || '').toLowerCase() === 'true';
      if (existingId && !overwrite) {
        return bad(res, 'DOJ already exists (use ?overwrite=true or PUT)', 409);
      }

      // if overwriting, remove previous record & mapping
      if (existingId && overwrite) {
        const prev = await getById(existingId);
        await kv.del(recKey(existingId));
        await kv.zrem(indexKey, existingId);
        if (prev?.dojReportNumber)
          await kv.del(dojMapKey(prev.dojReportNumber));
      }

      const id = nanoid(12);

      const rec = {
        id,
        // 'date' = case date (if given) else now; createdAt = now
        date: body.date ? new Date(body.date).toISOString() : nowISO,
        createdAt: nowISO,

        incidentId: String(body.incidentId),
        dojReportNumber: String(body.dojReportNumber),
        leadingId: Number(body.leadingId),

        supervising: Array.isArray(body.supervising) ? body.supervising : [],
        attorneyObservers: Array.isArray(body.attorneyObservers) ? body.attorneyObservers.map(Number) : [],
        paralegalObservers: Array.isArray(body.paralegalObservers) ? body.paralegalObservers.map(Number) : [],

        verdict: body.verdict,
        benchVerdictNumber: body.verdict === 'BENCH_REQUEST' ? (body.benchVerdictNumber || null) : null,

        chargesRemoved: !!body.chargesRemoved,
        chargesReplaced: !!body.chargesRemoved && !!body.chargesReplaced,

        fine: body.fine === null || body.fine === '' || body.fine === undefined ? null : Number(body.fine),
        sentenceMonths: body.sentenceMonths === null || body.sentenceMonths === '' || body.sentenceMonths === undefined ? null : Number(body.sentenceMonths),

        cellCallType: body.cellCallType,
        notes: body.notes || '',
        by: body.by || body.loggedBy || 'web',
      };

      await kv.set(recKey(id), rec);
      await kv.zadd(indexKey, { score: Date.parse(rec.createdAt), member: id });
      // DOJ mapping
      await kv.set(dojMapKey(rec.dojReportNumber), id);

      return ok(res, rec);
    } catch (e) {
      console.error('POST /api/records error', e);
      return bad(res, 'Failed to save record', 500);
    }
  }

  // ---------- PUT (update) ----------
  if (req.method === 'PUT') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const id = getIdFromReq(req) || body.id;
      if (!id) return bad(res, 'id required');

      const existing = await getById(id);
      if (!existing) return bad(res, 'Not found', 404);

      const updatedAt = new Date().toISOString();

      // compute next value; keep createdAt
      const next = {
        ...existing,
        ...body,
        id,
        createdAt: existing.createdAt,
        updatedAt,
        // normalize some fields if provided
        incidentId: body.incidentId !== undefined ? String(body.incidentId) : existing.incidentId,
        dojReportNumber: body.dojReportNumber !== undefined ? String(body.dojReportNumber) : existing.dojReportNumber,
        leadingId: body.leadingId !== undefined ? Number(body.leadingId) : existing.leadingId,
        fine: body.fine === '' ? null : (body.fine !== undefined ? Number(body.fine) : existing.fine),
        sentenceMonths: body.sentenceMonths === '' ? null : (body.sentenceMonths !== undefined ? Number(body.sentenceMonths) : existing.sentenceMonths),
      };

      // if DOJ changed, update the mapping
      if (next.dojReportNumber !== existing.dojReportNumber) {
        if (existing.dojReportNumber) await kv.del(dojMapKey(existing.dojReportNumber));
        await kv.set(dojMapKey(next.dojReportNumber), id);
      }

      await kv.set(recKey(id), next);
      // keep index score by createdAt (as before)

      return ok(res, next);
    } catch (e) {
      console.error('PUT /api/records error', e);
      return bad(res, 'Failed to update record', 500);
    }
  }

  // ---------- DELETE ----------
  if (req.method === 'DELETE') {
    try {
      const id = getIdFromReq(req);
      if (!id) return bad(res, 'id required');

      // load to drop DOJ mapping too
      const rec = await getById(id);

      await kv.del(recKey(id));
      await kv.zrem(indexKey, id);
      if (rec?.dojReportNumber) {
        const mappedId = await kv.get(dojMapKey(rec.dojReportNumber));
        if (mappedId === id) {
          await kv.del(dojMapKey(rec.dojReportNumber));
        }
      }

      return ok(res, { ok: true });
    } catch (e) {
      console.error('DELETE /api/records error', e);
      return bad(res, 'Failed to delete record', 500);
    }
  }

  res.setHeader('Allow', 'GET,POST,PUT,DELETE,OPTIONS');
  return bad(res, 'Method Not Allowed', 405);
}

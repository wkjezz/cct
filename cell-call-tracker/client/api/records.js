// client/pages/api/records.js
import { kv } from '@vercel/kv';
import { nanoid } from 'nanoid';

function ok(res, data) {
  return res.status(200).json(data);
}
function bad(res, msg, code = 400) {
  return res.status(code).json({ error: msg });
}

function getIdFromReq(req) {
  try {
    const url = new URL(req.url, 'http://localhost');
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

export default async function handler(req, res) {
  // Basic CORS (safe for same-origin too)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ---------- GET: list (with filters) ----------
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, 'http://localhost');
      const from = parseISOorNull(url.searchParams.get('from'));
      const to = parseISOorNull(url.searchParams.get('to'));
      const staffId = url.searchParams.get('staffId') || '';
      const cellCallType = url.searchParams.get('cellCallType') || '';
      const incidentType = url.searchParams.get('incidentType') || '';

      // read all ids from the index (newest first)
      const ids = await kv.zrange('records:index', 0, -1, { rev: true });
      if (!ids || ids.length === 0) return ok(res, []);

      // fetch records in bulk
      const recKeys = ids.map(id => `record:${id}`);
      const list = (await kv.mget(recKeys)).filter(Boolean);

      // filter
      const filtered = list.filter(r => {
        const ts = r.createdAt || r.date;
        const t = Date.parse(ts);
        if (from && (!Number.isFinite(t) || t < from.getTime())) return false;
        if (to && (!Number.isFinite(t) || t > to.getTime())) return false;
        if (staffId && String(r.leadingId) !== String(staffId)) return false;
        if (cellCallType && r.cellCallType !== cellCallType) return false;
        if (incidentType && r.incidentType !== incidentType) return false;
        return true;
      });

      return ok(res, filtered);
    } catch (e) {
      console.error('GET /api/records error', e);
      return bad(res, 'Failed to load records', 500);
    }
  }

  // ---------- POST: create ----------
  if (req.method === 'POST') {
    try {
      const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      if (!b.incidentId) return bad(res, 'incidentId required');
      if (!b.dojReportNumber) return bad(res, 'dojReportNumber required');
      if (b.leadingId === undefined || b.leadingId === null) return bad(res, 'leadingId required');

      const id = nanoid(12);
      const nowISO = new Date().toISOString();

      const rec = {
        id,
        // original date (from the case) if provided, else now:
        date: b.date ? new Date(b.date).toISOString() : nowISO,
        createdAt: nowISO,

        incidentId: String(b.incidentId),
        dojReportNumber: String(b.dojReportNumber),
        leadingId: Number(b.leadingId),

        supervising: Array.isArray(b.supervising) ? b.supervising : [],
        attorneyObservers: Array.isArray(b.attorneyObservers) ? b.attorneyObservers.map(Number) : [],
        paralegalObservers: Array.isArray(b.paralegalObservers) ? b.paralegalObservers.map(Number) : [],

        verdict: b.verdict,
        benchVerdictNumber: b.verdict === 'BENCH_REQUEST' ? (b.benchVerdictNumber || null) : null,

        chargesRemoved: !!b.chargesRemoved,
        chargesReplaced: !!b.chargesRemoved && !!b.chargesReplaced,

        fine: b.fine === null || b.fine === '' || b.fine === undefined ? null : Number(b.fine),
        sentenceMonths: b.sentenceMonths === null || b.sentenceMonths === '' || b.sentenceMonths === undefined ? null : Number(b.sentenceMonths),

        cellCallType: b.cellCallType,
        incidentType: b.incidentType,
        notes: b.notes || '',
        by: b.by || b.loggedBy || 'web',
      };

      await kv.set(`record:${id}`, rec);
      await kv.zadd('records:index', { score: Date.parse(rec.createdAt), member: id });

      return ok(res, rec);
    } catch (e) {
      console.error('POST /api/records error', e);
      return bad(res, 'Failed to save record', 500);
    }
  }

  // ---------- DELETE: by id ----------
  if (req.method === 'DELETE') {
    try {
      const id = getIdFromReq(req);
      if (!id) return bad(res, 'id required');

      await kv.del(`record:${id}`);
      await kv.zrem('records:index', id);

      return ok(res, { ok: true });
    } catch (e) {
      console.error('DELETE /api/records error', e);
      return bad(res, 'Failed to delete record', 500);
    }
  }

  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');
  return bad(res, 'Method Not Allowed', 405);
}

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // CORS/headers (harmless for same-origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // --- helper: extract id from /api/records/<id> or ?id= ---
  const getIdFromReq = () => {
    try {
      const url = new URL(req.url, 'http://localhost'); // base required for Node URL
      // path variant: /api/records/<id>
      const m = url.pathname.match(/\/api\/records\/([^/]+)/);
      if (m && m[1]) return m[1];
      // query variant: ?id=
      return url.searchParams.get('id') || req.query?.id || null;
    } catch {
      return req.query?.id || null;
    }
  };

  // --------- DELETE ----------
  if (req.method === 'DELETE') {
    const id = getIdFromReq();
    if (!id) return res.status(400).json({ error: 'id required' });

    // remove from KV
    await kv.del(`record:${id}`);
    await kv.zrem('records:index', id);

    return res.status(200).json({ ok: true });
  }

  // ... your existing GET/POST logic stays as-is below ...
  // if (req.method === 'GET') { ... }
  // if (req.method === 'POST') { ... }

  res.setHeader('Allow', 'GET,POST,DELETE,OPTIONS');
  return res.status(405).json({ error: 'Method Not Allowed' });
}

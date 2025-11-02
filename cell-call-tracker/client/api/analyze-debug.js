// Lightweight debug endpoint to check OCR_SPACE_API_KEY presence and basic connectivity.
// Does NOT reveal the key value.

const fetchMaybe = async (...args) => {
  if (typeof fetch === 'function') return fetch(...args);
  const nodeFetch = await import('node-fetch').then(m => m.default || m);
  return nodeFetch(...args);
};

export default async function handler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });

    const hasKey = !!process.env.OCR_SPACE_API_KEY;
    const keyLen = process.env.OCR_SPACE_API_KEY ? String(process.env.OCR_SPACE_API_KEY).length : 0;

    // Try a simple connectivity check to api.ocr.space (HEAD request) — does not require key
    let reachable = false;
    try {
      const r = await fetchMaybe('https://api.ocr.space/parse/image', { method: 'HEAD' });
      reachable = !!r && (r.status >= 200 && r.status < 500);
    } catch (e) {
      reachable = false;
    }

    return res.json({ ok: true, hasKey, keyLength: keyLen, ocrEndpointReachable: reachable });
  } catch (err) {
    console.error('analyze-debug error', err);
    return res.status(500).json({ error: 'debug failed', details: String(err) });
  }
}

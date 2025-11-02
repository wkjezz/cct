// Vercel serverless function to proxy images to OCR.space and return parsed fields.
// Uses OCR_SPACE_API_KEY environment variable in Vercel.

const fetchMaybe = async (...args) => {
  if (typeof fetch === 'function') return fetch(...args);
  const { default: nodeFetch } = await import('node-fetch');
  return nodeFetch(...args);
};

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function heuristicsFromText(text) {
  const dojMatch = String(text).match(/\b\d{6}\b/);
  const doj = dojMatch ? dojMatch[0] : null;
  const incMatch = String(text).match(/\b[A-Z0-9]{6}\b/i);
  const incident = incMatch ? incMatch[0] : null;

  let dateMatch = String(text).match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (!dateMatch) dateMatch = String(text).match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
  let date = dateMatch ? dateMatch[0] : new Date().toISOString().slice(0,10);
  if (date && date.includes('/')) {
    const parts = date.split('/').map(p => p.padStart(2,'0'));
    if (parts.length === 3) date = `${parts[2]}-${parts[0]}-${parts[1]}`;
  }

  return { dojReportNumber: doj, incidentId: incident, date, notes: String(text).slice(0,2000) };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const body = req.body || {};
    const dataUrl = body.image;
    if (!dataUrl) return res.status(400).json({ error: 'image required' });

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) return res.status(400).json({ error: 'invalid image data' });

    const apiKey = process.env.OCR_SPACE_API_KEY;
    let text = '';

    if (apiKey) {
      const params = new URLSearchParams();
      params.append('apikey', apiKey);
      params.append('base64Image', `data:${parsed.mime};base64,${parsed.base64}`);
      params.append('language', 'eng');
      params.append('isOverlayRequired', 'false');

      const r = await fetchMaybe('https://api.ocr.space/parse/image', { method: 'POST', body: params });
      const j = await r.json();
      if (!j || !j.ParsedResults || !j.ParsedResults[0]) {
        console.error('ocr.space no parsed results', j);
        return res.status(500).json({ error: 'ocr failed', raw: j });
      }
      text = j.ParsedResults.map(p => p.ParsedText).join('\n');
    } else {
      // No OCR key available — return raw text placeholder so client can handle
      return res.status(500).json({ error: 'OCR_SPACE_API_KEY not configured on server' });
    }

    const out = heuristicsFromText(text);
    return res.json(out);
  } catch (err) {
    console.error('analyze function error', err);
    return res.status(500).json({ error: 'analysis failed', details: String(err) });
  }
};

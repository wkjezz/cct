// Vercel serverless function under the client project so /api/analyze exists in the deployed frontend.
// Proxies base64 images to OCR.space using OCR_SPACE_API_KEY env var and returns parsed fields.

import fs from 'fs';
import path from 'path';

const fetchMaybe = async (...args) => {
  if (typeof fetch === 'function') return fetch(...args);
  const nodeFetch = await import('node-fetch').then(m => m.default || m);
  return nodeFetch(...args);
};

function parseDataUrl(dataUrl) {
  const m = String(dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], base64: m[2] };
}

function heuristicsFromText(text) {
  const t = String(text || '');
  // DOJ / Report number: prefer explicit "Report 123456" or 6-digit sequences
  let doj = null;
  const repMatch = t.match(/Report\s+#?:?\s*(\d{5,7})/i) || t.match(/Report\s+(\d{5,7})/i);
  if (repMatch) doj = repMatch[1];
  if (!doj) {
    const dojMatch = t.match(/\b(\d{6})\b/);
    if (dojMatch) doj = dojMatch[1];
  }

  // Incident ID: look for explicit label
  let incident = null;
  const incMatch = t.match(/Incident\s*ID[:\s]*([A-Z0-9]{4,8})/i) || t.match(/Incident[:\s]*([A-Z0-9]{4,8})/i);
  if (incMatch) incident = incMatch[1];
  if (!incident) {
    const inc2 = t.match(/\bID[:\s]*(\d{6})\b/i);
    if (inc2) incident = inc2[1];
  }

  // Date parsing (ISO or mm/dd/yyyy)
  let dateMatch = t.match(/\b\d{4}-\d{2}-\d{2}\b/);
  if (!dateMatch) dateMatch = t.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/);
  let date = dateMatch ? dateMatch[0] : new Date().toISOString().slice(0,10);
  if (date && date.includes('/')) {
    const parts = date.split('/').map(p => p.padStart(2,'0'));
    if (parts.length === 3) date = `${parts[2]}-${parts[0]}-${parts[1]}`;
  }

  // Cell call type heuristics
  let cellCallType = null;
  if (/cell\s*call/i.test(t)) cellCallType = 'CELL_CALL';
  else if (/warrant|arrest/i.test(t)) cellCallType = 'WARRANT_ARREST';
  else if (/sentenc/i.test(t)) cellCallType = 'SENTENCING_HEARING';

  // Verdict heuristics
  let verdict = null;
  if (/NOT\s*GUILTY/i.test(t)) verdict = 'NOT_GUILTY';
  else if (/GUILTY/i.test(t)) verdict = 'GUILTY';
  else if (/NO\s*CONTEST/i.test(t)) verdict = 'NO_CONTEST';
  else if (/BENCH/i.test(t)) verdict = 'BENCH_REQUEST';

  // Charges heuristics
  const chargesRemoved = /charges removed|state impound|state impound/i.test(t) ? true : undefined;
  const chargesReplaced = /charges replaced/i.test(t) ? true : undefined;

  // Fine and sentence heuristics (simple numbers near $ or 'months')
  let fine = null;
  const fineMatch = t.match(/\$\s*(\d{1,6})/);
  if (fineMatch) fine = Number(fineMatch[1]);
  let sentenceMonths = null;
  const sentMatch = t.match(/(\d{1,3})\s*(months|mo\b)/i);
  if (sentMatch) sentenceMonths = Number(sentMatch[1]);

  return {
    dojReportNumber: doj,
    incidentId: incident,
    date,
    cellCallType,
    verdict,
    chargesRemoved,
    chargesReplaced,
    fine,
    sentenceMonths,
    notes: t.slice(0,2000)
  };
}

export default async function handler(req, res) {
  try {
    // CORS for same-origin usage
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    // parse body (Vercel may supply string or parsed object)
    const body = (() => {
      try { return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch { return {}; }
    })();
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

      try {
        const r = await fetchMaybe('https://api.ocr.space/parse/image', { method: 'POST', body: params });
        const status = r.status;
        // attempt JSON parse, but fall back to text for diagnostics
        let j = null;
        try { j = await r.json(); } catch (pj) {
          const txt = await r.text().catch(() => '<unreadable body>');
          console.error('ocr.space returned non-json', { status, body: txt });
          return res.status(502).json({ error: 'ocr.space returned non-json', status, body: txt });
        }

        if (!r.ok) {
          console.error('ocr.space returned error', { status, body: j });
          return res.status(502).json({ error: 'ocr.space returned error', status, body: j });
        }

        if (!j || !j.ParsedResults || !j.ParsedResults[0]) {
          console.error('ocr.space no parsed results', j);
          return res.status(502).json({ error: 'ocr.space parse failed', status, raw: j });
        }

        text = j.ParsedResults.map(p => p.ParsedText).join('\n');
      } catch (fetchErr) {
        console.error('ocr.space fetch error', fetchErr);
        return res.status(502).json({ error: 'ocr.space fetch error', details: String(fetchErr) });
      }
    } else {
      console.error('OCR_SPACE_API_KEY not configured in environment');
      return res.status(500).json({ error: 'OCR_SPACE_API_KEY not configured on server' });
    }

    const out = heuristicsFromText(text);

    // Attempt to match leading attorney by first name against client/data/staff.json
    try {
      const staffPath = path.join(process.cwd(), 'data', 'staff.json');
      if (fs.existsSync(staffPath)) {
        const staff = JSON.parse(fs.readFileSync(staffPath, 'utf-8')) || [];
        for (const s of staff) {
          if (!s || !s.name) continue;
          const first = String(s.name).split(' ')[0];
          if (first && text.toLowerCase().includes(first.toLowerCase())) { out.leadingId = s.id; break; }
        }
      }
    } catch (e) {
      // non-fatal
      console.error('staff match error', e);
    }

    return res.json(out);
  } catch (err) {
    console.error('analyze function error', err);
    return res.status(500).json({ error: 'analysis failed', details: String(err) });
  }
}

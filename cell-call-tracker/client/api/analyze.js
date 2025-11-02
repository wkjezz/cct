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

export default async function handler(_req, res) {
  // Smart fill feature is currently disabled. Keep the function present but respond with 410
  // so it can be re-enabled later without removing code.
  res.setHeader('Content-Type', 'application/json');
  return res.status(410).json({ ok: false, disabled: true, reason: 'Smart fill (OCR) feature is disabled' });
}

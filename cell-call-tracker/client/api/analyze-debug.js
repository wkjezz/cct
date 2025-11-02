// Lightweight debug endpoint to check OCR_SPACE_API_KEY presence and basic connectivity.
// Does NOT reveal the key value.

const fetchMaybe = async (...args) => {
  if (typeof fetch === 'function') return fetch(...args);
  const nodeFetch = await import('node-fetch').then(m => m.default || m);
  return nodeFetch(...args);
};

export default async function handler(_req, res) {
  // Debug endpoint disabled while Smart fill is shelved.
  res.setHeader('Content-Type', 'application/json');
  return res.status(410).json({ ok: false, disabled: true, reason: 'Smart fill debug endpoint disabled' });
}

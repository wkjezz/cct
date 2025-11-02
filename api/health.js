// Simple health endpoint for Vercel serverless
module.exports = (_req, res) => {
  res.status(200).json({ ok: true });
};

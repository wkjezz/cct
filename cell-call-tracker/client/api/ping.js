export default async function handler(req, res) {
  try {
    const mod = await import('../../api/ping.js')
    return mod.default(req, res)
  } catch (err) {
    console.error('proxy ping error', err)
    res.status(500).json({ error: String(err).slice(0,1000) })
  }
}

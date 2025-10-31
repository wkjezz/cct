export default async function handler(req, res) {
  try {
    const mod = await import('../../../api/auth/login.js')
    return mod.default(req, res)
  } catch (err) {
    console.error('proxy auth/login error', err)
    res.status(500).json({ error: String(err).slice(0,1000) })
  }
}

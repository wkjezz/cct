import { clearCookieHeader } from '../_auth.js'

export default async function handler(req, res) {
  try {
    res.setHeader('Set-Cookie', clearCookieHeader())
    res.writeHead(302, { Location: '/' })
    res.end()
  } catch (err) {
    console.error('/api/auth/logout error', err)
    return res.status(500).json({ ok: false })
  }
}

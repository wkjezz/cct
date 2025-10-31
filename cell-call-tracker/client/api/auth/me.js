import { getUserFromReq } from '../_auth.js'

export default async function handler(req, res) {
  try {
    const user = getUserFromReq(req)
    if (!user) return res.status(401).json({ ok: false })
    return res.status(200).json({ ok: true, user })
  } catch (err) {
    console.error('/api/auth/me error', err)
    return res.status(500).json({ ok: false })
  }
}

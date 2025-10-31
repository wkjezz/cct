import { getTokenFromReq } from '../_auth.js'

export default function handler(req, res){
  const cookieName = process.env.SESSION_COOKIE_NAME || 'cct_session'
  // Clear cookie
  const cookie = `${cookieName}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax` + (process.env.NODE_ENV === 'production' ? '; Secure' : '')
  res.setHeader('Set-Cookie', cookie)
  res.status(200).json({ ok: true })
}

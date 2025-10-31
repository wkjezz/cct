import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.AUTH_JWT_SECRET || ''
// Primary editor IDs (comma-separated) provided via environment.
const RAW_EDITOR_IDS = (process.env.EDITOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
// Optional comma-separated list of IDs to exclude (useful for temporary preview testing).
const EXCLUDE_EDITOR_IDS = (process.env.EDITOR_EXCLUDE_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
// Final editor list excludes any IDs present in EXCLUDE_EDITOR_IDS
const EDITOR_IDS = RAW_EDITOR_IDS.filter(id => !EXCLUDE_EDITOR_IDS.includes(id))
const COOKIE_NAME = 'cct_session'

function parseCookies(req) {
  const header = req.headers?.cookie || req.headers?.Cookie || ''
  return header.split(';').map(p => p.trim()).filter(Boolean).reduce((acc, kv) => {
    const [k, ...rest] = kv.split('=')
    acc[k] = rest.join('=')
    return acc
  }, {})
}

export function signUser(user) {
  if (!JWT_SECRET) throw new Error('AUTH_JWT_SECRET not configured')
  const payload = {
    id: String(user.id),
    username: user.username,
  admin: EDITOR_IDS.includes(String(user.id)),
    avatar: user.avatar || null,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function getUserFromReq(req) {
  try {
    const cookies = parseCookies(req)
    const token = cookies[COOKIE_NAME]
    if (!token) return null
    if (!JWT_SECRET) throw new Error('AUTH_JWT_SECRET not configured')
    const user = jwt.verify(token, JWT_SECRET)
    // normalize
    return {
      id: String(user.id),
      username: user.username,
      admin: !!user.admin,
      avatar: user.avatar || null,
    }
  } catch (err) {
    return null
  }
}

export function cookieHeaderForToken(token) {
  // HttpOnly cookie for site-wide session
  const maxAge = 7 * 24 * 3600 // 7 days
  // Note: Secure is applied; in local dev (non-HTTPS) the cookie may be blocked by browsers.
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax; Secure`
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax; Secure`
}

export function isAdminId(id) {
  return EDITOR_IDS.includes(String(id))
}

export { EDITOR_IDS }

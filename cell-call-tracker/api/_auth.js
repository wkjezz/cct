import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret-change-me'
const EDITOR_IDS = (process.env.EDITOR_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'cct_session'

export function signUser(user, opts = {}){
  const payload = { id: user.id, username: user.username, discriminator: user.discriminator }
  const isEditor = EDITOR_IDS.includes(String(user.id))
  payload.isEditor = isEditor
  return jwt.sign(payload, JWT_SECRET, { expiresIn: opts.expiresIn || '1d' })
}

export function verifyToken(token){
  try{
    return jwt.verify(token, JWT_SECRET)
  }catch(e){ return null }
}

export function getTokenFromReq(req){
  const cookie = req.headers?.cookie || ''
  const parts = cookie.split(';').map(p=>p.trim())
  for(const p of parts){
    if(p.startsWith(COOKIE_NAME+'=')) return decodeURIComponent(p.split('=')[1] || '')
  }
  return null
}

export function getUserFromReq(req){
  const token = getTokenFromReq(req)
  if(!token) return null
  return verifyToken(token)
}

export function editorIds(){ return EDITOR_IDS }

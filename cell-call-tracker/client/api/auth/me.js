import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'dev-secret-change-me'
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'cct_session'

function getTokenFromReq(req){
  const cookie = req.headers?.cookie || ''
  const parts = cookie.split(';').map(p=>p.trim())
  for(const p of parts){
    if(p.startsWith(COOKIE_NAME+'=')) return decodeURIComponent(p.split('=')[1] || '')
  }
  return null
}

function verifyToken(token){
  try{ return jwt.verify(token, JWT_SECRET) }catch(e){ return null }
}

export default function handler(req, res){
  const token = getTokenFromReq(req)
  if(!token) return res.status(200).json(null)
  const user = verifyToken(token)
  if(!user) return res.status(200).json(null)
  return res.status(200).json({ id: user.id, username: user.username, discriminator: user.discriminator, isEditor: !!user.isEditor })
}

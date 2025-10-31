#!/usr/bin/env node
import http from 'http'
import url from 'url'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'

function loadEnv(file) {
  try {
    const text = fs.readFileSync(file, 'utf8')
    return Object.fromEntries(text.split(/\n+/).map(l=>l.trim()).filter(Boolean).map(l=>l.split('=')).map(([k,...v])=>[k, v.join('=').replace(/^"|"$/g,'')]))
  } catch { return {} }
}

const cwd = path.resolve()
const envFile = path.join(cwd, '.env.local')
const env = loadEnv(envFile)

const SECRET = process.env.AUTH_JWT_SECRET || env.AUTH_JWT_SECRET || 'change_this_to_a_random_secret'
const PORT = process.env.DEV_AUTH_PORT || 4000
const EDITOR_IDS = (process.env.EDITOR_IDS || env.EDITOR_IDS || '').split(',').map(s=>s.trim()).filter(Boolean)

function signToken(id, username, admin) {
  return jwt.sign({ id: String(id), username, admin: !!admin }, SECRET, { expiresIn: '7d' })
}

function setCookieHeader(token) {
  const maxAge = 7 * 24 * 3600
  // For local testing we do NOT set Secure so browsers accept it over HTTP
  return `cct_session=${token}; Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax`
}

const server = http.createServer((req, res) => {
  const u = url.parse(req.url, true)
  if (u.pathname === '/login') {
    // /login?role=admin|viewer&id=...&redirect=
    const role = (u.query.role || 'viewer')
    const id = u.query.id || (role === 'admin' ? (EDITOR_IDS[0] || '1006310774035206244') : '200000000000000000')
    const username = u.query.username || (role==='admin' ? 'admin#0001' : 'viewer#0001')
    const redirect = u.query.redirect || (u.headers.referer || `http://localhost:3000`)
    const token = signToken(id, username, role==='admin')
    res.setHeader('Set-Cookie', setCookieHeader(token))
    res.writeHead(302, { Location: redirect })
    res.end()
    return
  }

  if (u.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok:true, note: 'dev-auth server running' }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

server.listen(PORT, ()=>{
  console.log(`Dev auth server listening on http://localhost:${PORT}`)
  console.log('To set an admin session visit:')
  console.log(`  http://localhost:${PORT}/login?role=admin&redirect=http://localhost:3000`)
  console.log('To set a viewer session visit:')
  console.log(`  http://localhost:${PORT}/login?role=viewer&redirect=http://localhost:3000`)
})

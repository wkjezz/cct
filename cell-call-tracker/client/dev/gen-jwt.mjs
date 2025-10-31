#!/usr/bin/env node
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

const argv = process.argv.slice(2)
let id = argv[0]
let isAdmin = (argv[1] === 'admin')
let username = argv[2] || (isAdmin ? 'admin#0001' : 'viewer#0001')
if (!id) {
  console.error('Usage: npm run gen-jwt <discordId> [admin|viewer] [username]')
  process.exit(2)
}

const payload = { id: String(id), username, admin: !!isAdmin }
const token = jwt.sign(payload, SECRET, { expiresIn: '7d' })
console.log(token)

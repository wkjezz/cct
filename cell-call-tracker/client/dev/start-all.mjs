#!/usr/bin/env node
import { spawn } from 'child_process'
import path from 'path'

const mode = process.argv[2] || 'vite' // 'vite' or 'vercel'
const cwd = path.resolve()

function start(name, cmd, args, options = {}){
  const p = spawn(cmd, args, { stdio: ['ignore','pipe','pipe'], shell: true, env: process.env, ...options })
  p.stdout.on('data', d => { process.stdout.write(`[${name}] ${d}`) })
  p.stderr.on('data', d => { process.stderr.write(`[${name}] ${d}`) })
  p.on('exit', (code, sig) => { console.log(`${name} exited ${code ?? ''} ${sig ?? ''}`) })
  return p
}

console.log(`start-all: mode=${mode}`)

// start dev-auth first
const devAuth = start('dev-auth', 'npm', ['run','dev-auth'], { cwd })

// small delay before starting frontend to let auth server bind
setTimeout(()=>{
  if (mode === 'vercel'){
    console.log('Starting vercel dev (requires vercel CLI and login)')
    start('vercel', 'npx', ['vercel','dev'], { cwd })
  } else {
    console.log('Starting vite dev')
    start('vite', 'npm', ['run','dev'], { cwd })
  }
}, 400)

// graceful shutdown
process.on('SIGINT', ()=>{
  console.log('\nstart-all: received SIGINT, shutting down')
  try{ devAuth.kill() }catch{}
  process.exit(0)
})

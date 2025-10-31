#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import crypto from 'crypto'

const cwd = path.resolve()
const example = path.join(cwd, '.env.local.example')
const target = path.join(cwd, '.env.local')

function fileExists(p){ try{ return fs.existsSync(p) }catch{return false} }

if (!fileExists(example)){
  console.error('.env.local.example not found in', cwd)
  process.exit(1)
}

if (!fileExists(target)){
  console.log('Creating .env.local from example...')
  let text = fs.readFileSync(example, 'utf8')
  // ensure AUTH_JWT_SECRET set
  if (!/AUTH_JWT_SECRET=/m.test(text)){
    text += `\nAUTH_JWT_SECRET=${crypto.randomBytes(32).toString('hex')}\n`
  } else {
    // replace empty or placeholder
    text = text.replace(/AUTH_JWT_SECRET=.*(?:\n|$)/m, `AUTH_JWT_SECRET=${crypto.randomBytes(32).toString('hex')}\n`)
  }
  fs.writeFileSync(target, text, 'utf8')
  console.log('.env.local created')
} else {
  console.log('.env.local already exists — leaving as-is')
}

function runCmd(cmd, args, opts={}){
  return new Promise((resolve, reject)=>{
    const p = spawn(cmd, args, { stdio: 'inherit', shell: true, env: process.env, ...opts })
    p.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)))
  })
}

(async function main(){
  try{
    console.log('Installing dependencies (this may take a minute)')
    await runCmd('npm', ['install'])

    // start combined dev servers (dev:all)
    const mode = process.argv[2] || 'vite'
    console.log('Starting dev servers in mode:', mode)
    if (mode === 'vercel') {
      await runCmd('npm', ['run', 'dev:all:vercel'])
    } else {
      await runCmd('npm', ['run', 'dev:all'])
    }
  }catch(err){
    console.error('setup-dev failed:', err.message)
    process.exit(1)
  }
})()

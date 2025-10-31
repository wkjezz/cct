export default async function handler(_req, res){
  const results = { ts: new Date().toISOString(), ok: true, imports: {}, cwd: process.cwd(), node: process.version }
  // Try importing a few key modules used by the server functions
  const probes = [
    { name: 'api_ping', path: '../../api/ping.js' },
    { name: 'api_auth_login', path: '../../../api/auth/login.js' },
    { name: 'api_records', path: '../../api/records.js' }
  ]

  for (const p of probes) {
    try {
      const mod = await import(p.path)
      results.imports[p.name] = { ok: true, hasDefault: typeof mod.default === 'function' }
    } catch (err) {
      results.imports[p.name] = { ok: false, error: String(err).slice(0,1000) }
      results.ok = false
    }
  }

  // Also attempt a shallow fs listing of the function folder (safe, non-secret)
  try {
    const fs = await import('fs')
    const path = await import('path')
    const dir = path.join(process.cwd(), 'api')
    let list = []
    try { list = fs.readdirSync(dir) } catch (e) { list = ['err:'+String(e).slice(0,200)] }
    results.files = list
  } catch (e) {
    results.files = ['fs import failed', String(e).slice(0,200)]
    results.ok = false
  }

  res.setHeader('Content-Type','application/json')
  res.status(results.ok ? 200 : 500).json(results)
}

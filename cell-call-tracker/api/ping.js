export default function handler(_req, res){
  res.setHeader('Content-Type','application/json')
  res.status(200).json({ ok: true, service: 'cell-call-tracker', ts: new Date().toISOString() })
}

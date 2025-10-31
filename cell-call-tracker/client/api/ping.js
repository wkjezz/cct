export default async function handler(req, res) {
  const mod = await import('../../api/ping.js')
  return mod.default(req, res)
}

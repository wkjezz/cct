export default async function handler(req, res) {
  const mod = await import('../../../api/auth/me.js')
  return mod.default(req, res)
}

export default async function handler(req, res) {
  const mod = await import('../../../api/auth/logout.js')
  return mod.default(req, res)
}

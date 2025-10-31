export default async function handler(req, res) {
  const mod = await import('../../../api/auth/login.js')
  return mod.default(req, res)
}

const DISCORD_AUTHORIZE = 'https://discord.com/api/oauth2/authorize'

export default function handler(req, res){
  try {
    const clientId = process.env.DISCORD_CLIENT_ID
    const redirect = process.env.DISCORD_REDIRECT_URI || (process.env.BASE_URL ? `${process.env.BASE_URL}/api/auth/callback` : '/api/auth/callback')
    const scope = 'identify'
    const state = ''

    // DEBUG: return environment values so we can see why this function fails in prod.
    return res.status(200).json({ clientId: !!clientId, redirect, baseUrl: process.env.BASE_URL || null })
  } catch (err) {
    console.error('auth/login error', err)
    res.status(500).json({ error: String(err) })
  }
}

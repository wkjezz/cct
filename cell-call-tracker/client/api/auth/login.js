import { EDITOR_IDS } from '../_auth.js'

const DISCORD_AUTH = 'https://discord.com/api/oauth2/authorize'

export default async function handler(req, res) {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID
    if (!clientId) return res.status(500).json({ error: 'DISCORD_CLIENT_ID not configured' })

    // Build redirect URI to our callback endpoint
    const base = process.env.BASE_URL || ''
    const redirect = `${base || ''}/api/auth/callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'identify',
      prompt: 'consent',
    })

    const url = `${DISCORD_AUTH}?${params.toString()}`
    // redirect user to Discord
    res.writeHead(302, { Location: url })
    res.end()
  } catch (err) {
    console.error('/api/auth/login error', err)
    return res.status(500).json({ error: 'Server error' })
  }
}

import { signUser, cookieHeaderForToken } from '../_auth.js'

async function exchangeCodeForToken(code, redirect) {
  const params = new URLSearchParams()
  params.append('client_id', process.env.DISCORD_CLIENT_ID || '')
  params.append('client_secret', process.env.DISCORD_CLIENT_SECRET || '')
  params.append('grant_type', 'authorization_code')
  params.append('code', code)
  params.append('redirect_uri', redirect)

  const resp = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })
  if (!resp.ok) throw new Error('Token exchange failed')
  return resp.json()
}

async function fetchDiscordUser(access_token) {
  const r = await fetch('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` }
  })
  if (!r.ok) throw new Error('Failed to fetch user')
  return r.json()
}

export default async function handler(req, res) {
  try {
    const code = req.query?.code || (new URL(req.url, 'http://localhost')).searchParams.get('code')
    if (!code) return res.status(400).send('Missing code')

    const base = process.env.BASE_URL || ''
    const redirect = `${base || ''}/api/auth/callback`

    const tokenResp = await exchangeCodeForToken(code, redirect)
    const access_token = tokenResp.access_token
    if (!access_token) return res.status(500).send('No access token')

    const user = await fetchDiscordUser(access_token)

    // build avatar URL if present
    let avatarUrl = null
    if (user.avatar) {
      const ext = String(user.avatar).startsWith('a_') ? 'gif' : 'png'
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`
    }

    const jwt = signUser({ id: user.id, username: `${user.username}#${user.discriminator}`, avatar: avatarUrl })
    // set cookie and redirect home
    res.setHeader('Set-Cookie', cookieHeaderForToken(jwt))
    res.writeHead(302, { Location: '/' })
    res.end()
  } catch (err) {
    console.error('/api/auth/callback error', err)
    return res.status(500).send('Auth callback error')
  }
}

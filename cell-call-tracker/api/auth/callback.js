import fetch from 'node-fetch'
import { signUser } from '../_auth.js'

export default async function handler(req, res){
  try{
    const code = req.query?.code || req.url && new URL(req.url, 'http://localhost').searchParams.get('code')
    if(!code) return res.status(400).send('Missing code')

    const tokenUrl = 'https://discord.com/api/oauth2/token'
    const params = new URLSearchParams()
    params.append('client_id', process.env.DISCORD_CLIENT_ID || '')
    params.append('client_secret', process.env.DISCORD_CLIENT_SECRET || '')
    params.append('grant_type', 'authorization_code')
    params.append('code', code)
    params.append('redirect_uri', process.env.DISCORD_REDIRECT_URI || (process.env.BASE_URL ? `${process.env.BASE_URL}/api/auth/callback` : ''))

    const tokenResp = await fetch(tokenUrl, { method:'POST', headers:{ 'Content-Type': 'application/x-www-form-urlencoded' }, body: params })
    if(!tokenResp.ok) {
      const t = await tokenResp.text()
      console.error('token exchange failed', t)
      return res.status(500).send('Token exchange failed')
    }
    const tokenJson = await tokenResp.json()
    const access = tokenJson.access_token
    if(!access) return res.status(500).send('No access token')

    // Fetch user info
    const userResp = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access}` } })
    if(!userResp.ok) return res.status(500).send('Failed to fetch user')
    const user = await userResp.json()

    // Sign JWT and set cookie
    const jwt = signUser({ id: user.id, username: user.username, discriminator: user.discriminator })
    const cookieName = process.env.SESSION_COOKIE_NAME || 'cct_session'
    const maxAge = 60 * 60 * 24 // 1 day
    const cookie = `${cookieName}=${encodeURIComponent(jwt)}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax` + (process.env.NODE_ENV === 'production' ? '; Secure' : '')
    res.setHeader('Set-Cookie', cookie)

    // Redirect back to app
    const home = process.env.BASE_URL || '/'
    res.writeHead(302, { Location: home })
    res.end()
  }catch(e){
    console.error('auth callback error', e)
    res.status(500).send('Auth callback error')
  }
}

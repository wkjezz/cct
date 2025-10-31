// Redirect to Discord OAuth2 authorize URL
const DISCORD_AUTHORIZE = 'https://discord.com/api/oauth2/authorize'

export default function handler(req, res){
  const clientId = process.env.DISCORD_CLIENT_ID
  const redirect = process.env.DISCORD_REDIRECT_URI || (process.env.BASE_URL ? `${process.env.BASE_URL}/api/auth/callback` : '/api/auth/callback')
  const scope = 'identify'
  const state = ''

  if(!clientId) return res.status(500).send('DISCORD_CLIENT_ID not configured')

  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope, prompt: 'consent', state })
  res.writeHead(302, { Location: `${DISCORD_AUTHORIZE}?${params.toString()}` })
  res.end()
}

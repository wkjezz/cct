# Local development & auth testing (dev)

This file describes how to run the app locally and exercise the auth flow without deploying to Vercel.

Prereqs
- Node 18+ and npm
- (Optional) `vercel` CLI if you want to emulate serverless functions (`npm i -g vercel`)

Files added for local testing
- `dev/dev-auth-server.mjs` — tiny HTTP server that issues a dev JWT cookie and redirects to your app. Use for quick admin/viewer sessions.
- `dev/gen-jwt.mjs` — generate a JWT from the local `AUTH_JWT_SECRET` for manual testing or curl.

Quick start (recommended, realistic)

1. Install deps

```bash
cd cell-call-tracker/client
npm install
```

2. Create `.env.local` from the example and set a long `AUTH_JWT_SECRET`:

```bash
cp .env.local.example .env.local
# Edit .env.local and set AUTH_JWT_SECRET to a secure random string
```

3. Start the dev auth helper (in a separate terminal)

```bash
cd cell-call-tracker/client
npm run dev-auth
# runs at http://localhost:4000 by default
```

4. Start the app + serverless emulation (Vercel dev)

If you want the closest experience to production (serverless functions under `/api`), use `vercel dev`:

```bash
# from cell-call-tracker/client
vercel dev
# open the URL printed by vercel (or use the default http://localhost:3000)
```

5. Create a session and return to your app

Open in your browser (example for admin):

```
http://localhost:4000/login?role=admin&redirect=http://localhost:3000
```

Or viewer:

```
http://localhost:4000/login?role=viewer&redirect=http://localhost:3000
```

This will set a `cct_session` HttpOnly cookie (for local testing the cookie is not `Secure`) and redirect to your app. The UI will then call `/api/auth/me` and proceed.

Fast alternative (Vite only, no serverless emulation)

If you only want to run the frontend with Vite (no `/api` functions), run:

```bash
npm run dev
# app typically at http://localhost:5173
```

Then either:
- Use the dev auth server above and redirect to the Vite dev URL, or
- Generate a JWT and set the cookie manually (see below).

Generate a JWT manually

```bash
cd cell-call-tracker/client
# admin token
npm run gen-jwt 1006310774035206244 admin
# viewer token
npm run gen-jwt 200000000000000000 viewer
```

Then copy the token and in the browser console for the app origin run:

```js
document.cookie = 'cct_session=PASTE_TOKEN_HERE; path=/;'
window.location.reload()
```

Testing endpoints with curl

Assuming your app + API are available at `http://localhost:3000` and you have a token in $TOKEN:

```bash
# auth check
curl -i -H "Cookie: cct_session=$TOKEN" http://localhost:3000/api/auth/me

# list records
curl -i -H "Cookie: cct_session=$TOKEN" "http://localhost:3000/api/records"

# create record (admin only)
curl -i -H "Cookie: cct_session=$TOKEN" -H "Content-Type: application/json" -X POST -d '{"incidentId":"ABC123","dojReportNumber":"000001","leadingId":1006310774035206244}' http://localhost:3000/api/records
```

Notes
- Dev auth server purposely omits the `Secure` flag on cookies so they work over `http://localhost`. Do not use it in production.
- For full OAuth verification (Discord redirect), configure your Discord application's redirect URI to point at your public dev URL (ngrok or Vercel preview) and set `BASE_URL` accordingly.

If you'd like, I can also add a small `make dev` or shell script to start both the app and the dev-auth server in parallel.

# Trade Pursuit — web client

React + Vite frontend for Trade Pursuit. Deploy on Vercel; it talks to the API on Render.

## Run locally
```bash
npm install
npm run dev     # http://localhost:5173 (proxies /api to http://localhost:4000)
```
To use the hosted API locally instead, create `.env.local` with `VITE_API_URL=https://<your-api>.onrender.com`.

## Deploy on Vercel (free)
Add New → Project → import this repository.

| Setting | Value |
|---|---|
| Framework Preset | Vite |
| Root Directory | `./` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |
| Node.js Version (Settings → General) | 22.x |

Environment variable (all environments):

| Key | Value |
|---|---|
| `VITE_API_URL` | your Render API URL, e.g. `https://trade-pursuit-api.onrender.com` (no trailing slash) |

`VITE_API_URL` is baked in at build time: after changing it, redeploy.

`vercel.json` already sends every route to `index.html`, so links like `/journal` work on refresh.

Then add your Vercel URL to `CLIENT_ORIGIN` on the Render service, or the browser will block API calls.

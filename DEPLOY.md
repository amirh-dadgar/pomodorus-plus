# Deploying Pomodorus to production (Vercel + Convex)

The Convex production side is **already deployed and configured**, so the first Vercel deploy is zero-config: import and click Deploy.

## Current production state

- Convex production deployment: `tacit-clam-994` (`https://tacit-clam-994.convex.cloud`), running the local-first sync functions (deployed 2026-07-25). A version-skew incident from deploying the Vercel app before the Convex functions is what motivated the CI setup below — prefer it.
- Auth (`JWT_PRIVATE_KEY`, `JWKS`) is configured on it, and `SITE_URL` is set to `https://pomodorus.vercel.app` (adjust below if your URL differs).
- `.env.production` (committed) pins `NEXT_PUBLIC_CONVEX_URL` to the production deployment, so a plain `npm run build` on Vercel connects to production Convex with no dashboard env vars.
- `DEV_FAST_POMODORO` is **not** set on production — the 3-second test sessions are rejected there. Keep it that way.

## First deploy

1. In Vercel: **Add New → Project** → import `yazdanctx/pomodorus`. Framework preset: **Next.js** (auto-detected). Change nothing else.
2. Click **Deploy**.
3. If Vercel assigned a URL other than `https://pomodorus.vercel.app`, point auth at the real one (from a clone of this repo, after `npx convex login`):

   ```bash
   npx convex env set SITE_URL https://<your-app>.vercel.app --prod
   ```

   Applies immediately, no redeploy needed.

## PWA / offline notes

- The service worker (`public/sw.js`) registers **in production builds only** — `next dev` never caches. To test offline behavior locally: `npm run build && npm start`, visit once signed in, then go offline.
- The timer is local-first (`docs/adr/0001-local-first-timer.md`): sessions complete on the device and sync to Convex via `sync.push` whenever the client is online. The feed reads best-effort `presence` rows.
- After changing cached assets or the caching strategy, bump `VERSION` in `public/sw.js` so installed clients refresh.
- Install on macOS: open the deployed site in Chrome → address-bar install icon (or Safari → File → Add to Dock). The installed app opens at `/app`.

## Sanity checklist after deploy

- Landing page loads with the feed empty state.
- Signup works (username required, immutable); the production database starts empty — dev accounts don't carry over.
- Start a 25-minute session; it shows up in the feed from a second browser.
- Desktop notification + chime fire at session end (Vercel is HTTPS, so the Notification API is available).

## Ongoing deploys — important

Pushing to `main` redeploys **only the Next.js app**. Whenever `convex/` changes (schema or functions), the production Convex deployment must be updated too:

```bash
npx convex deploy
```

To automate that instead, switch Vercel to the CI setup:

1. Convex dashboard → project **pomodorus** → **Settings** → **Deploy keys** (Production) → generate a key.
2. Vercel project → **Settings → Environment Variables**: add `CONVEX_DEPLOY_KEY` (Production scope).
3. Vercel project → **Settings → Build & Development Settings** → Build Command:

   ```
   npx convex deploy --cmd 'npm run build'
   ```

With that in place, every push to `main` deploys Convex and the app together (and `NEXT_PUBLIC_CONVEX_URL` is injected by the deploy command, overriding `.env.production`).

## Local development

Unchanged: `npx convex dev` + `npm run dev` (HTTPS on `https://localhost:3000`) against the dev deployment `vibrant-cheetah-995`. `.env.local` overrides `.env.production` locally, so local work never touches production.

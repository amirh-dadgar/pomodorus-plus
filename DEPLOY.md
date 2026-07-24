# Deploying Pomodorus to production (Vercel + Convex)

Run everything below on your local computer, from a fresh clone of this repo.

## 0. Prerequisites

- Node.js 20+ and npm
- A [Vercel](https://vercel.com) account with access to the `yazdanctx/pomodorus` GitHub repo
- Access to the Convex project (team `yazdun`, project `pomodorus`)

```bash
git clone https://github.com/yazdanctx/pomodorus.git
cd pomodorus
npm install
npx convex login        # log into the Convex account that owns the project
```

## 1. Create the Convex production deploy key

1. Open the [Convex dashboard](https://dashboard.convex.dev) → project **pomodorus** → **Settings** → **Deploy keys** (make sure the **Production** deployment is selected, not `dev:vibrant-cheetah-995`).
2. Generate a **production deploy key** and copy it. You'll paste it into Vercel in step 2.

## 2. Create the Vercel project

1. In the Vercel dashboard: **Add New → Project** → import `yazdanctx/pomodorus`. Framework preset: **Next.js** (auto-detected). Keep the root directory as the repo root.
2. Before the first deploy, in the project's **Settings**:
   - **Environment Variables** → add `CONVEX_DEPLOY_KEY` = the key from step 1, scoped to **Production**.
   - **Build & Development Settings** → override **Build Command** with:

     ```
     npx convex deploy --cmd 'npm run build'
     ```

   This makes every Vercel production build first push the Convex functions/schema to the production deployment and inject `NEXT_PUBLIC_CONVEX_URL` for the Next.js build automatically — you do not set that variable by hand.

## 3. First deploy

Trigger a deploy (push to `main`, or press **Deploy** in Vercel). It will build, but **auth won't work yet** — the production Convex deployment has no auth keys. Note the production URL Vercel assigns (e.g. `https://pomodorus.vercel.app`).

## 4. Configure Convex Auth on the production deployment

From the repo directory on your machine:

```bash
npx @convex-dev/auth --prod
```

This generates and sets `JWT_PRIVATE_KEY` and `JWKS` on the **production** Convex deployment and prompts for `SITE_URL` — enter your production URL from step 3 (e.g. `https://pomodorus.vercel.app`).

If you ever need to set it manually instead:

```bash
npx convex env set SITE_URL https://pomodorus.vercel.app --prod
```

Env changes on the Convex deployment apply immediately; no Vercel redeploy needed.

## 5. Sanity checklist

- **Do NOT set `DEV_FAST_POMODORO` on production.** Without it, the server rejects the 3-second test session, and production builds don't show the ⚡ option anyway.
- The production database starts empty — dev accounts (and anything else in `dev:vibrant-cheetah-995`) do not carry over. Sign up fresh; usernames are required and immutable.
- Verify on the live URL: landing page shows the feed empty state, signup with a username works, a 25-minute session appears in the feed from a second browser, and desktop notifications + the chime fire at session end (Vercel serves HTTPS, so the Notification API is available).

## Day-to-day afterwards

- Pushing to `main` auto-deploys: Convex functions and the Next.js app stay in sync because of the build command override.
- Local development is unchanged: `npx convex dev` + `npm run dev` (HTTPS on `https://localhost:3000`) against the dev deployment.

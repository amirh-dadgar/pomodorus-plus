# Pomodorus — Spec

A very minimal Persian-language pomodoro app with a realtime global activity feed.

## Stack

- Next.js (App Router, TypeScript) + Tailwind + shadcn/ui, with `motion` for transitions
- Convex (database, realtime, server functions)
- Convex Auth — Password provider only. No email verification, no password reset, no email infrastructure. Email is the private login identifier and is never shown publicly.
- Signup fields: email, password, **username** (unique, immutable, `[a-z0-9_]{3,20}`; the only public identity — shown in the feed, on profiles, and in profile URLs. There is no display name).
- No password or email-format constraints: any non-empty strings are accepted as credentials (even `test` / `test`) — casual personal app, no email infrastructure to justify format checks.

## Look & language

- Single hard-coded theme: pitch black `#000000` background, white text, monochrome. No theme toggle.
- Flat: no corner radius (`--radius: 0rem`), no shadows, and no dividing rules between sections — spacing does the separating.
- Entire UI in Persian, RTL, local Peyda (FaNum) font.
- Copy voice: extremely casual Gen-Z Persian (colloquial spelling, loanwords like فوکوس/چیل). Applies to all user-facing text including server error messages. All copy is centralized in `lib/copy.json`.
- Persian digits everywhere (e.g. ۲۵:۰۰) and Jalali (Shamsi) dates, via `Intl` with `fa-IR-u-ca-persian`.
- App name: **Pomodorus**.
- **No layout shift from auth or data resolving.** Controls that depend on unresolved state reserve their exact final box rather than rendering nothing — the NavBar CTA, the landing CTA and today's focus. Reserving space is not guessing content: the placeholder never predicts which label wins, so shift is removed without reintroducing a flash of the wrong CTA.
- The theme is monochrome, so nothing can be flagged by hue: `--destructive` is the same grey as `--muted-foreground`. Errors separate themselves by being full white, iconned and boxed instead.

## Auth page

- One route, `/login`, toggling between sign-in and sign-up. The NavBar is hidden here, so the page carries its own link back to the landing.
- Sign-up states plainly that the username can never be changed, since there is no rename path.
- Submitting shows a spinner and a waiting label, not just a disabled button.
- Failures render as a bordered, iconned, full-white alert in an `aria-live` region — not as grey text indistinguishable from the field hints.

## Timer model (local-first)

See `docs/adr/0001-local-first-timer.md` for why this replaced the original server-authoritative model.

- The device that runs a session owns it: `startedAt` + `duration` live in local storage; start, countdown, completion, break auto-start, and cycle counting are all local and work fully offline.
- Sessions survive refresh/tab close. If the app is closed when the end time passes, the session is finalized retroactively on next launch.
- Convex is a log, not the source of truth: completed work sessions are appended to history on sync, whenever the device is next online.
- Work durations: **25 or 55 minutes**, chosen per session on the start screen as two explicit adjacent options (the chosen one is filled). No settings page.
- The start screen also shows **today's focus**: the current Tehran day's completed session count and total, read from the server. Signed-out, loading and offline all show a blank row of the same height; only a server-confirmed total may say the day is empty. See `docs/adr/0002-todays-focus-from-the-server.md`.
- A running session shows a flat progress bar of elapsed share beneath the clock, measured against the real end time (so a dev fast session fills over its 3 seconds).
- Short break: **5 min** after each completed session. Long break: **20 min** after every 4th completed session.
- Breaks auto-start when a work session completes, and are skippable.
- No pause. Controls are: start, cancel (work), skip (break).
- Cancel voids the session: no history credit, cycle counter unchanged.
- Cycle counter: increments per completed work session; resets to 0 after the long break (taken or skipped) and after **1 hour of idleness** (no running session/break). Tracked locally.
- No one-running-session-per-user rule: completed sessions from every device all count, with no dedup. A two-device user can double-count focus time; accepted.

## Categories

- The category **is** the task label. Fields: name, public/private flag.
- Created inline in the start-screen picker; rename, visibility toggle, and delete supported — all fully offline.
- Cannot delete/edit a category while a session is running on it (checked locally). Deleting keeps past focus time: it tombstones the category, keeping its name, and past sessions keep pointing at it.
- Sync conflicts resolve last-write-wins: latest timestamped change per category wins, delete beats rename, duplicate names are tolerated.

## Pages & routing

- `/` — public landing (no auth), top to bottom: a full-bleed **hero** image band, the app name with a one-line pitch and the CTA (signed-in → `/app`, signed-out → `/login`), the **experimental notice**, a personal note about why the app exists, and the live feed. Plus the same header button in the NavBar.
- The hero is one fixed image from `public/banners`, cropped to 16:9 from its square source and served unoptimized (the AVIF sources are already minimal; re-encoding them triples their size). It is deliberately not a random draw like the profile's banners — it is the LCP element, so it may not wait on a client-side pick.
- The experimental notice is a static, non-dismissible alert saying the app is experimental and data may be lost. It sits after the CTA, and only on the landing.
- `/app` — the timer app (auth required).
- `/u/[username]` — public profile (no auth): username and the **focus chart** — a single minimal line of total focus time per Tehran day over a selected range (presets: last 7/30/90 days, default 7; no custom picker), zero-filled on empty days, Jalali axis labels. Only completed work sessions count; totals and breakdowns are computed from the sessions log.
- Pointing at the chart (hover or touch drag) selects a day; a docked **day detail** panel below the chart (never a floating tooltip) shows that day's per-category rows sorted largest first, each with a progress bar sized as its share of the day's total. Defaults to the most recent day with data.
- The day detail opens with a two-column header: the day's total set as a large `h:mm` clock beside a square image drawn from `public/banners`. The clock is captioned — Jalali date above it as a small muted label, «ساعت کار متمرکز» below set like the clock itself — so the bare number is never left to stand for itself. The image is picked at random the first time a day is shown and kept for the rest of the visit, so pointing along the chart never reshuffles the art; consecutive draws avoid each other. All images preload, and swaps are instant — no fade.
- The chart is zero-filled, so a day with no focus time can still be pointed at. It has no day detail: the panel is not rendered at all rather than showing a zero.
- Every change of day fades (`motion`), as does the panel appearing and disappearing — each day's panel is its own arrival and departure. The outgoing panel finishes leaving before the incoming one arrives, since the two differ in height with the category list.
- There is no share-as-PNG button. One was built and parked, then dropped along with `html-to-image`; a visitor who wants to share a day detail screenshots it themselves.
- Day-detail privacy: visitors see public category names; all private categories collapse into one masked «تسک خصوصی» row. The owner sees real names everywhere plus a disclaimer that private tasks are hidden from others. Deleted categories keep their preserved name; sessions without a category (and empty-name tombstones) form one unmasked "no task" row.
- There is no separate private history page; a user's own profile serves that purpose.

## Global feed

- One global feed, publicly visible (landing page and inside the app).
- The feed shows **presence**: a best-effort advertisement published when an online client starts a session (or reconnects mid-session), self-expiring at the session's end time. It is advisory, not truth — an offline cancel can leave a stale entry for up to one session length; a session started offline appears late or not at all.
- Shows users currently **working**: username (linked to their profile) + category name + remaining time. Private category → shown as a private task, name hidden.
- Shows users currently **on break**: username + break label.
- Idle users don't appear. The heading always renders and the body holds a row's height, so the section never vanishes: empty shows an "everybody's offline" message, offline shows the offline notice, and a query still in flight shows neither.

## Offline & PWA

- Installable PWA (`app/manifest.ts`, `display: standalone`, black theme/background). Manifest `name`/`short_name`: **Pomodorus** (Latin). Installed app's `start_url` is `/app`.
- Icons: one mark everywhere — a macOS-style rounded squircle, bold white line-art tomato on black, monochrome. Provided as favicon, PWA icons (192/512 + maskable with safe-zone padding), apple-touch-icon, and the NavBar logo, which loads the same `/icon.svg` so the bar can never drift from the installed app.
- Offline scope: `/app` is fully functional (timer, categories, own history from local data). `/` loads from cache with the feed replaced by an offline notice. `/u/[username]` is online-only; offline it shows a friendly offline page.
- Offline requires having signed in at least once on the device; first-ever visit offline shows a "need internet to sign in" screen. An expired auth token never blocks the timer — unsynced data is held and syncs right after re-login.
- Sync is fully automatic on reconnect: completed sessions append to history, category changes apply last-write-wins. No sync buttons or dialogs; the only UI is a subtle indicator (casual Persian copy) when offline or holding unsynced data.

## Dev fast mode

- Dev builds run every session as a 3-second test session: credited as its full nominal duration (`devFast: true`), but finished locally after 3s. Its auto-breaks also run in 3s while stored at nominal duration. The sync mutation drops `devFast` sessions unless the `DEV_FAST_POMODORO` env var is set on the Convex deployment, so production never credits them.

## Notifications

- Notification permission requested when the user starts a session (browsers require a user gesture for the prompt).
- System notification plus a short WebAudio chime (no audio asset) when a work session or break ends; live countdown in the tab title.
- Ends are detected from local session completion (the timer is local-first), so they fire offline too, including for dev fast sessions. Cancels and skipped breaks don't notify.
- Known limit (no push server): notifications only fire while the app is open in some tab or installed window (background OK, fully closed no).

## Environment

- Local dev against a Convex dev deployment. Production: Vercel + Convex production deployment (see `DEPLOY.md`).

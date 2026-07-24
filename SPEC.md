# Pomodorus — Spec

A very minimal Persian-language pomodoro app with a realtime global activity feed.

## Stack

- Next.js (App Router, TypeScript) + Tailwind + shadcn/ui
- Convex (database, realtime, server functions)
- Convex Auth — Password provider only. No email verification, no password reset, no email infrastructure. Email is the private login identifier and is never shown publicly.
- Signup fields: email, password, **display name** (shown publicly in the feed), **username** (unique, immutable, `[a-z0-9_]{3,20}`; used in public profile URLs).

## Look & language

- Single hard-coded theme: pitch black `#000000` background, white text, monochrome. No theme toggle.
- Entire UI in Persian, RTL, local Peyda (FaNum) font.
- Copy voice: extremely casual Gen-Z Persian (colloquial spelling, loanwords like فوکوس/چیل). Applies to all user-facing text including server error messages. All copy is centralized in `lib/copy.json`.
- Persian digits everywhere (e.g. ۲۵:۰۰) and Jalali (Shamsi) dates, via `Intl` with `fa-IR-u-ca-persian`.
- App name: **Pomodorus**.

## Timer model (server-authoritative)

- Session state lives in Convex: `startedAt` + `duration`. Clients only render the countdown.
- Sessions survive refresh/tab close; a session completes when its end time passes, even if no tab is open.
- Work durations: **25 or 55 minutes**, chosen per session on the start screen. No settings page.
- Short break: **5 min** after each completed session. Long break: **20 min** after every 4th completed session.
- Breaks auto-start when a work session completes, and are skippable.
- No pause. Controls are: start, cancel (work), skip (break).
- Cancel voids the session: no history credit, cycle counter unchanged.
- Cycle counter: increments per completed work session; resets to 0 after the long break (taken or skipped) and after **1 hour of idleness** (no running session/break).
- One running session per user at a time, enforced server-side.

## Categories

- The category **is** the task label. Fields: name, public/private flag.
- Created inline in the start-screen picker; rename, visibility toggle, and delete supported.
- Cannot delete/edit a category while a session is running on it. Deleting keeps past focus time (history stores daily aggregates independent of category).

## Pages & routing

- `/` — public landing (no auth): app name, one-line pitch, the live feed, and a header button (signed-in → `/app`, signed-out → `/login`).
- `/app` — the timer app (auth required).
- `/u/[username]` — public profile (no auth): display name, username, and daily focus history (Jalali date + focus time per day, newest first). Only completed work sessions count.
- There is no separate private history page; a user's own profile serves that purpose.

## Global feed

- One global feed, publicly visible (landing page and inside the app).
- Shows users currently **working**: display name (linked to their profile) + category name + remaining time. Private category → shown as a private task, name hidden.
- Shows users currently **on break**: display name + break label.
- Idle users don't appear. Empty feed shows an "everybody's offline" message.

## Dev fast mode

- With the `DEV_FAST_POMODORO` env var set on the (dev) Convex deployment, the start screen (dev builds only) offers a 3-second test session: stored and credited as a full 25 minutes (`devFast: true` on the row), but finalized after 3s. Its auto-breaks also run in 3s while stored at nominal duration. The mutation rejects the fast flag when the env var is absent.

## Notifications

- Notification permission requested when the user starts a session (browsers require a user gesture for the prompt).
- System notification plus a short WebAudio chime (no audio asset) when a work session or break ends; live countdown in the tab title.
- Ends are detected via the server-recorded completion (`endedAt` / `lastEnded` in `myState`), so they also fire for dev fast sessions. Cancels and skipped breaks don't notify.
- Known limit (no push server): notifications only fire while the app is open in some tab (background tab OK, closed browser no).

## Environment

- Local dev against a Convex dev deployment. Vercel deployment deferred.

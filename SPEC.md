# Pomodorus — Spec

A very minimal Persian-language pomodoro app with a realtime global activity feed.

## Stack

- Next.js (App Router, TypeScript) + Tailwind + shadcn/ui
- Convex (database, realtime, server functions)
- Convex Auth — Password provider only. No email verification, no password reset, no email infrastructure. Email is effectively a username.
- Signup fields: email, password, **display name** (shown publicly in the feed).

## Look & language

- Single hard-coded theme: pitch black `#000000` background, white text, monochrome. No theme toggle.
- Entire UI in Persian, RTL, Vazirmatn font.
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

## Global feed

- One global feed visible to all signed-in users.
- Shows users currently **working**: display name + category name + remaining time. Private category → «در حال کار روی تسک خصوصی».
- Shows users currently **on break**: display name + «استراحت».
- Idle users don't appear.

## History

- Private per-user page: daily rows, newest first — Jalali date, total focus minutes, completed session count.
- Only completed work sessions count.

## Notifications

- Notification permission requested upfront after login.
- System notification when a work session or break ends; live countdown in the tab title.
- Known limit (no push server): notifications only fire while the app is open in some tab (background tab OK, closed browser no).

## Environment

- Local dev against a Convex dev deployment. Vercel deployment deferred.

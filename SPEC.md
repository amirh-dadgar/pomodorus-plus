# Pomodorus — Spec

A very minimal Persian-language pomodoro app with a realtime global activity feed.

## Stack

- Next.js (App Router, TypeScript) + Tailwind + shadcn/ui, with `motion` for transitions
- Convex (database, realtime, server functions)
- Convex Auth — credentials only, username + password. No email anywhere: no address is collected, verified or stored, and there is no password reset (nowhere to send it).
- Login fields: **username** (unique, immutable, `[a-z0-9_]{3,20}`; the only public identity — shown in the feed, on profiles, and in profile URLs. There is no display name) and password. The username is both the public handle and the login credential.
- One flow, not two: submitting an unknown username creates that account, a known one signs in, and a known one with the wrong password is the only failure. Accepted cost — a mistyped username makes a new empty account rather than saying «wrong password».
- No password constraints: any non-empty string is accepted (even `test` / `test`) — casual personal app.

## Look & language

- Single hard-coded theme: pitch black `#000000` background, white text, monochrome. No theme toggle.
- Flat: no corner radius (`--radius: 0rem`), no shadows, and no dividing rules between sections — spacing does the separating.
- Entire UI in Persian, RTL, local Peyda (FaNum) font.
- Copy voice: extremely casual Gen-Z Persian (colloquial spelling, loanwords like فوکوس/چیل). Applies to all user-facing text including server error messages. All copy is centralized in `lib/copy.json`.
- Persian digits everywhere (e.g. ۲۵:۰۰) and Jalali (Shamsi) dates, via `Intl` with `fa-IR-u-ca-persian`.
- App name: **Pomodorus**.
- **No layout shift from auth or data resolving.** Controls that depend on unresolved state reserve their exact final box rather than rendering nothing — the NavBar CTA, the landing CTA and today's focus. Reserving space is not guessing content: the placeholder never predicts which label wins, so shift is removed without reintroducing a flash of the wrong CTA.
- The theme is monochrome, so nothing can be flagged by hue: `--destructive` is the same grey as `--muted-foreground`. Errors separate themselves by being full white, iconned and boxed instead.
- **One exception, and only one: a ringing timer is red.** The ring clock and the NavBar badge take `rose-500` because a clock that has stopped meaning "time left" and started counting up has to be unmistakable across a room. Nothing else in the app is allowed a hue — errors included.
- No emoji in user-facing copy for the timer or its alerts; anything the user must actually read goes in the bordered, iconned alert box the login page and the category picker already use.
- All dialogs share one inset — `p-6`, widening to `sm:p-20` and `sm:max-w-lg` on anything above a phone — set on `DialogContent` rather than per dialog, so there is one place it can drift from.

## Auth page

- One route, `/login`, with one form and one button — no sign-in/sign-up toggle, since the server decides which it is. The NavBar is hidden here, so the page carries its own link back to the landing.
- A profane username cannot be created (see **Profanity**); the server says so in the same alert as any other failure. An account that already has one still signs in.
- Kept bare: the username field's format hint is the only standing text, and the experimental notice is the only other thing on the page. Neither the immutability of the username nor the fact that an unused one signs you up is spelled out.
- Submitting shows a spinner and a waiting label, not just a disabled button.
- Failures render as a bordered, iconned, full-white alert in an `aria-live` region — not as grey text indistinguishable from the field hints.

## Timer model (local-first)

See `docs/adr/0001-local-first-timer.md` for why this replaced the original server-authoritative model.

- The device that runs a session owns it: `startedAt` + `duration` live in local storage; start, countdown, completion, ringing, breaks, and cycle counting are all local and work fully offline.
- Sessions survive refresh/tab close. If the app is closed when the end time passes, the session is finalized retroactively on next launch — and, having no one to announce itself to at the time, comes back ringing silently.
- Convex is a log, not the source of truth: completed work sessions are appended to history on sync, whenever the device is next online.
- Work durations: **15–60 minutes in 5-minute steps**, default **25**, stepped on the start screen with a − / + pair either side of the clock; the button for an end you have reached is disabled. The picked task and the chosen length are persisted, so a reload does not lose them.
- The start screen also shows **today's focus**: the current Tehran day's completed session count and total, read from the server. Signed-out, loading and offline all show a blank row of the same height; only a server-confirmed total may say the day is empty. See `docs/adr/0002-todays-focus-from-the-server.md`.
- A running session shows a flat progress bar of elapsed share beneath the clock, measured against the real end time (so a dev fast session fills over its 3 seconds).
- No pause. Controls are: start, cancel (work), skip (break), and confirm (ringing).
- Cancel voids the session: no history credit, cycle counter unchanged. It is only available while work is *running* — a ringing session is already complete and cannot be retracted.
- Cycle counter: increments per completed work session; resets to 0 after the long break (taken or skipped) and after **1 hour of idleness**. Idleness is measured from a session's nominal end, never from when it was confirmed, so a long ring counts as the idleness it was. Tracked locally.

## Confirmed transitions

See `docs/adr/0004-confirmed-transitions.md`.

- **Nothing advances on its own.** A session that reaches its end enters **ringing** and stops there: no break auto-starts, no chain runs. However long the app was closed, at most one transition is ever due.
- A ringing session **alarms every 3 seconds, unbounded**, until confirmed. One system notification per ring, fired once with `requireInteraction` so it stays on screen — never re-fired on the ding cadence.
- **Ring time is not focus time.** A work session is credited at its exact nominal end, at its full nominal duration, and syncs from there without waiting to be acknowledged. Today's focus therefore ticks up at the bell. Confirming in two seconds or two hours produces identical history.
- **Ring time comes out of the break.** The break is anchored at the nominal end: confirm after 10s and it is `5:00 − 0:10`; ring past the whole break and there is none left, so confirming drops straight to idle.
- **Only an explicit tap confirms.** Tab focus, app resume, notification clicks and mouse movement do not.
- Confirming work starts the surviving break in one tap. Confirming a break offers two: **continue** (straight back into the same task at the same length) and **done** (back to the start screen, task and length still picked).
- **Audibility is decided once, when the ring is born.** Within a minute of the bell → audible until confirmed, however long that takes. Later → silent for good, visual only. Never re-judged, so an ordinary ring never gives up and a ring from yesterday never sounds.
- The alarm is **global**: a headless component in the root layout, so it reaches every route. Dings are scheduled on the WebAudio clock rather than `setInterval`, since hidden tabs clamp timers to about one callback a minute.
- Known limit: **a page reload silences a live alarm until the next interaction** — the AudioContext dies with the document and browsers require a gesture. The first pointer or key event anywhere re-unlocks it. The ring screen and the NavBar badge therefore carry the message without sound.
- Presence expires at the nominal end, so a ringing user leaves the feed at the bell. The NavBar badge instead **stays through the ring**, counting up rather than down, filled and belled so the inversion reads at a glance.

## Intervals

See `docs/adr/0005-device-local-intervals.md`.

- Four configurable intervals, defaulting to the classic technique: work **25**, short break **5**, long break **20**, long break every **4th** pomodoro.
- Ranges: work 15–60 by 5, short break 3–15, long break 10–35 by 5, pomodoros-per-cycle 2–6. The bands keep the app near the technique; within them it can be configured into something that is not it.
- `RANGES.work.max` is coupled to `MAX_SESSION_MS` in `lib/presence.ts` (60 min). Raise one without the other and the feed silently drops the session.
- **Device-local, never synced.** The device owns the timer (ADR 0001) and these durations are the timer; a phone and a laptop may legitimately disagree.
- The work length lives on the start screen, where it is a per-session decision. The breaks and cycle length live in a dialog opened from it — the app does have a settings surface now, but a deliberately quiet one.
- **A session carries the break lengths in force when it started**, so editing settings mid-session or mid-ring cannot change the break it hands you. Pomodoros-per-cycle is the exception: it describes the cycle, is read at completion, and applies immediately.
- Breaks remain skippable while running.
- No one-running-session-per-user rule: completed sessions from every device all count, with no dedup. A two-device user can double-count focus time; accepted.

## Categories

- The category **is** the task label. Fields: name, public/private flag.
- Created inline in the start-screen picker; rename, visibility toggle, and delete supported — all fully offline.
- Cannot delete/edit a category while a session is running on it (checked locally). Deleting keeps past focus time: it tombstones the category, keeping its name, and past sessions keep pointing at it.
- Sync conflicts resolve last-write-wins: latest timestamped change per category wins, delete beats rename, duplicate names are tolerated.
- A profane name is refused — on creation and on rename, offline included — and the picker says why. See **Profanity**.

## Profanity

See `docs/adr/0003-profanity-wordlist.md` for the wordlist's provenance and why the check sits where it does.

- Two things a user writes are shown to strangers: a public **category name** and a **username**. Neither may carry profanity, and both are checked against `lib/profanity.json` (Persian, plus a Latin list, since usernames are `[a-z0-9_]` and can only be profane in transliteration).
- Enforced at creation: a category name is refused by the device's own rules, so it works offline, and on rename as well as creation; a username is refused during signup. `sync.push` repeats the category check server-side, because the pending queue is editable localStorage.
- Enforced again at the feed, which drops any item whose label or username matches — that is what covers names and accounts created before the wordlist existed.
- Refusal is never silent: the picker shows the reason in the same white/boxed/iconned alert the login page uses for its failures.
- Signing in is not blocked. An account minted before the wordlist keeps working; it is simply never shown in the feed. Nothing is filtered on the way out to the person who wrote it — their own device, their own profile, their own history all read normally.
- Matching folds away spelling (Arabic-keyboard letters, vowel marks, ZWNJ, Persian digits, stretched letters, and words spelled out letter by letter) and covers Persian noun suffixes, but matches whole words rather than substrings. The list is trimmed of everything its public sources carry that is not profanity — animals, ethnicities, drugs, clinical anatomy, ordinary verbs like «کردن». A false positive takes a real person's task name away, so ambiguity resolves in favour of allowing.
- The list also carries a few names the app's owner keeps out of the feed, under a separate key. They are not profanity; they match identically.
- `lib/profanity.json` is generated. Rebuild it with `npx tsx scripts/build-profanity.ts`, which is also where words are added or excluded — not in the JSON.

## Pages & routing

- `/` — public landing (no auth), top to bottom: a full-bleed **hero** image band carrying the app name, a one-line pitch and the CTA (signed-in → `/app`, signed-out → `/login`), a personal note about why the app exists, and the live feed. Plus the same header button in the NavBar.
- The hero is one fixed image from `public/banners`, cropped to 16:9 from its square source and served unoptimized (the AVIF sources are already minimal; re-encoding them triples their size). It is deliberately not a random draw like the profile's banners — it is the LCP element, so it may not wait on a client-side pick.
- The experimental notice is a static, non-dismissible alert saying the app is experimental and data may be lost. It appears on `/login` only, at the top of the page in the hidden NavBar's band — it is aimed at someone about to create an account, not at everyone who opens the landing.
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
- Profanity: an item whose category name or username matches the wordlist is dropped whole — not masked. This is the last of four gates; see the **Profanity** section and `docs/adr/0003-profanity-wordlist.md`.
- Idle users don't appear. The heading always renders and the body holds a row's height, so the section never vanishes: empty shows an "everybody's offline" message, offline shows the offline notice, and a query still in flight shows neither.

## Offline & PWA

- Installable PWA (`app/manifest.ts`, `display: standalone`, black theme/background). Manifest `name`/`short_name`: **Pomodorus** (Latin). Installed app's `start_url` is `/app`.
- Icons: one mark everywhere — a macOS-style rounded squircle, bold white line-art tomato on black, monochrome. Provided as favicon, PWA icons (192/512 + maskable with safe-zone padding), and apple-touch-icon. The NavBar shows the same tomato **without the tile** — flat line-art in the foreground colour, since the squircle is there to sit on a dock or home screen and would be the only rounded corner in the UI.
- Offline scope: `/app` is fully functional (timer, categories, own history from local data). `/` loads from cache with the feed replaced by an offline notice. `/u/[username]` is online-only; offline it shows a friendly offline page.
- Offline requires having signed in at least once on the device; first-ever visit offline shows a "need internet to sign in" screen. An expired auth token never blocks the timer — unsynced data is held and syncs right after re-login.
- Sync is fully automatic on reconnect: completed sessions append to history, category changes apply last-write-wins. No sync buttons or dialogs; the only UI is a subtle indicator (casual Persian copy) when offline or holding unsynced data.

## Dev fast mode

- Dev builds run every session as a 3-second test session: credited as its full nominal duration (`devFast: true`), but finished locally after 3s. Its breaks also run in 3s while stored at nominal duration. The sync mutation drops `devFast` sessions unless the `DEV_FAST_POMODORO` env var is set on the Convex deployment, so production never credits them.
- A fast session rings like any other, and owes its **full nominal** break — so the ring-time deduction is measured against minutes that never really elapsed, and the "the ring ate the break" path cannot be reached in fast mode without waiting out the real break length.

## Notifications

- Notification permission requested when the user starts a session (browsers require a user gesture for the prompt).
- One system notification per ring, fired once with `requireInteraction` so it stays on screen until dismissed, plus the repeating WebAudio alarm (no audio asset). The tab title carries the live countdown, and the ring time once the bell has gone.
- Ends are detected from local session completion (the timer is local-first), so they fire offline too, including for dev fast sessions. Cancels and skipped breaks don't notify, and neither does a ring born stale.
- Known limit (no push server): notifications only fire while the app is open in some tab or installed window (background OK, fully closed no).

## Environment

- Local dev against a Convex dev deployment. Production: Vercel + Convex production deployment (see `DEPLOY.md`).

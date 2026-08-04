# Pomodorus

A minimal Persian-language pomodoro app with a realtime global activity feed, public profiles, and a public landing page.

## Language

### Identity

**Username**:
A user's unique, immutable, URL-safe public handle (lowercase latin letters, digits, underscore). The only public identity: shown in the feed, on profiles, and in profile URLs. There is no separate display name. It is also the login credential — the account is filed under it — so it is public and secret-adjacent at once: the password is the only secret.
_Avoid_: handle, slug, display name (removed concept), email (removed concept — no address is collected or stored)

### Pages

**Landing**:
The public root page anyone (signed-in or not) sees, in order: the hero, the one-line pitch and the way in, the personal note (`landing.sub`), and the live feed. Nothing on it is behind auth.
_Avoid_: home, welcome page

**Hero**:
The image band that opens the Landing: one fixed picture from `public/banners`, full-bleed across the content frame and cropped to 16:9 from its square source. Fixed rather than drawn per visit like a [[Banner]] — it is the first thing painted, so it may not depend on a client-side draw. Its box is owned by the wrapper, not by the image's intrinsic size: Turbopack cannot decode AVIF, so the import yields a bare URL with no dimensions and no blur data. Served `unoptimized`, since re-encoding an already-minimal AVIF triples its bytes.
_Avoid_: banner (that is the profile's per-day art), splash, masthead

**Experimental notice**:
The standing warning that the app is experimental and may lose data. Static and not dismissible. It lives on the login page alone, in the band the hidden [[NavBar]] would occupy — aimed at the moment an account is about to exist, rather than at everyone who opens the [[Landing]]. Never in the [[Timer app]], which is meant to be free of chrome.
_Avoid_: warning banner, disclaimer, toast

**Timer app**:
The signed-in working surface where sessions are started and run.
_Avoid_: profile, dashboard

**Profile**:
A public, read-only page for one user: their identity plus their focus chart. Publicly accessible without signing in. The owner viewing their own profile additionally sees private category names and a disclaimer that others don't.
_Avoid_: history page (the profile subsumed it), account page

**Focus chart**:
The profile's single line of total focus time per day over the selected range, zero-filled on empty days. The only view of focus history on the profile (it replaced the day list).
_Avoid_: graph, stats, history list

**Range**:
The window of Tehran-local days the focus chart covers: a preset of the last 7, 30, or 90 days ending today, defaulting to 7. Never a custom from–to span.
_Avoid_: period, filter

**Day detail**:
The per-category breakdown of one selected day: each category's focus time as a share of that day's total, largest first. Sessions without a category form their own unmasked bucket; deleted categories keep appearing under their preserved name. Selected by pointing at the chart; defaults to the most recent day with data.
_Avoid_: tooltip (it is a docked panel, not a floating tooltip), popup

**Focus history**:
Everything the profile renders below the header, as one value: the focus chart's days for the selected range plus which day detail is showing. It has five states — loading, no such user, reloading (a range switch, where the shell stays and only the chart area falls back to a skeleton), empty (no focus time anywhere in the range), and ready. `lib/focus-history.ts`.
_Avoid_: view model, chart state, profile data

**Banner**:
The square image beside a day detail's headline total, drawn at random from `public/banners`. One is assigned per user-and-day the first time that day is shown and kept for the rest of the page visit, so pointing along the chart never reshuffles the art; successive draws avoid each other. `lib/banners.ts`.
_Avoid_: art, image, thumbnail

### Timer

**Category**:
A user-defined label attached to work sessions (e.g. "درس", "کار"). Public categories show their name in the feed and in profile day details; private ones show as a private task — in a day detail, all private categories collapse into one masked bucket for visitors. Owned by one user; not shared. User-facing copy calls it "تسک" (casual register, like "چیل" for break); code and docs say category.
_Avoid_: task, tag, project (in code and docs)

**Session**:
One timed run — work or break — with a nominal duration. Owned by the device that runs it (local-first): it starts, completes, and is credited locally, then is reported to the server. A work session completes and is credited at its exact nominal end, before the user knows about it — completion is the clock's business, [[Confirmation]] is the user's. Completed work sessions from every device all count; there is no one-running-session-per-user rule.
_Avoid_: server-authoritative session (the old model)

**Ringing**:
The state a session is in between its nominal end and the user's [[Confirmation]]. The one state the app renders in a hue: the clock counts up in red, and what it wants from the user is set in the same bordered, iconned alert box as every other message worth reading. A session ends into ringing and stops there — nothing advances on its own (`docs/adr/0004-confirmed-transitions.md`). The session itself is already over and, if it was work, already credited and syncing; ringing changes nothing about the record. Whether a ring makes a sound is decided once, when it is born, and never revisited: born within a minute of the bell it is audible until confirmed however long that takes, born later it is a ring discovered on a launch long afterwards and is silent for good.
_Avoid_: overtime, extra time, overrun (all imply the session is still running), snooze, alarm state

**Ring time**:
How long a session has been [[Ringing]]. Never focus time and never becomes any. Its one effect is on the break: the break is anchored at the nominal end, so ring time is spent out of it — ring ten seconds for a four-fifty break, ring past the whole break and there is none left to take.
_Avoid_: overtime, idle time, elapsed

**Confirmation**:
The deliberate tap that ends [[Ringing]]. The only thing that does: focusing the tab, returning to the app, clicking the notification and moving the mouse all leave the ring alone. After work it starts whatever break survived the [[Ring time]]; after a break it is one of two — continue, which goes straight back to the same task, or done, which returns to the start screen with that task and length still picked. There is no cancel on a ring: the session is complete, indivisible and possibly already synced.
_Avoid_: dismiss, snooze, acknowledge, skip

**Interval**:
One of the four configurable durations — the pomodoro length, the short break, the long break, and how many pomodoros make a cycle. Device-local and never synced, so two devices may disagree about what a pomodoro is (`docs/adr/0005-device-local-intervals.md`). Each is clamped to a band around the classic technique, whose values (25/5/20, long break every 4th) are the defaults. A [[Session]] carries the break lengths in force when it started, so changing one mid-flight cannot alter the break it hands you; pomodoros-per-cycle is the exception and applies to the very next completion.
_Avoid_: setting, preference, duration (that is one session's own length), config

**Device**:
One browser's own copy of the timer: the running session, the cycle counter, the cached category mirror, and the unsynced queues, held in local storage under one username. It owns whatever it runs. Every rule for changing it is one `apply(state, command, env)` in `lib/local/device.ts`, pure and with the clock handed in; `lib/local/store.ts` is the one adapter that binds it to local storage, `Date.now` and `crypto.randomUUID`.
_Avoid_: client state, local store (that is the adapter, not the rules), reducer

**Today's focus**:
The line on the start screen giving the current Tehran day's completed work sessions and their total. The one part of the [[Timer app]] read from the server rather than from the [[Device]] (`sessions.todayFocus`, `docs/adr/0002-todays-focus-from-the-server.md`): local state keeps completed sessions only until they sync, so a local count would collapse to zero on reconnect. Signed out, loading and offline all render as a blank row of the same height — only a server-confirmed total may say the day is empty.
_Avoid_: today's stats, daily total, streak

**Fast session**:
A dev-only session that completes after seconds of real time but is recorded and credited at its full nominal duration. It rings like any other, and the break it owes is its full nominal one — so the [[Ring time]] deduction is measured against minutes that never really elapsed.
_Avoid_: test session, mock session

**Chill (چیل)**:
The casual-register term for a break in user-facing copy. The domain concept is still "break".

### Sync

**Presence**:
A best-effort advertisement that a user is currently in a session, published to the feed when the device is online and expiring on its own at the session's end time. Advisory, not truth: it can be stale for at most one session length (e.g. an offline cancel) and can appear late (a session started offline). The feed shows presence, nothing else.
_Avoid_: live session, active session (implies the server knows the truth)

**Sync**:
The automatic reconciliation that runs whenever a signed-in device regains the server: locally completed sessions are appended to history (never deduped), and category changes apply last-write-wins, with delete beating rename. Requires no user action.
_Avoid_: backup, upload (both suggest the server copy is primary)

**Unsynced**:
Local data — completed sessions or category changes — the server has not recorded yet. Surfaced only as a subtle indicator; never blocks using the app.
_Avoid_: pending, dirty, offline data

### Navigation

**NavBar**:
The single shared navigation bar rendered on all authenticated public pages (Landing, Timer app, Profile). Always shows the app logo (icon only, no text) — the app's own tomato mark rather than a stand-in glyph, drawn flat: the squircle tile, its gradient and its edge belong on a dock or home screen, not inside a UI with no corner radius. Inlined in `currentColor`, so it tracks the foreground and has no load state. Conditionally shows a CTA (login/timer link), a profile link, or a timer badge. Auth-dependent buttons never guess — but they now **reserve their box** rather than rendering nothing, so the bar keeps its height and the CTA its width while the auth state resolves. Being signed in without a cached username still counts as unresolved, up to a grace period, after which the CTA settles on the timer link so an unreachable `profiles.me` leaves a working link rather than a permanent placeholder.
_Avoid_: header, app header, nav bar (two words)

**Placeholder**:
A box of a control's exact final size, held while the state that decides the control is still resolving. Used for the NavBar CTA, the Landing CTA and [[Today's focus]]. The rule is that reserving space is not the same as guessing content: the placeholder never predicts which label will win, so it removes layout shift without reintroducing the flash of wrong CTA the NavBar was written to avoid.
_Avoid_: loading state, spinner, fallback

**Timer badge**:
A clickable indicator in the NavBar showing the remaining time of a running session (e.g. `۱۸:۴۲`). Navigates to `/app` on tap. Positioned near the CTA in the nav. Visible while a session is active and through a [[Ringing]] one, where it counts *up* instead of down — that is the moment a way back into the app matters most, and a reload can leave the alarm mute, so the badge may be the only thing saying so. Because its meaning is inverted there it turns red and belled rather than outlined, since the inversion has to read at a glance and not only in the digits.
_Avoid_: timer indicator, countdown badge

**Alarm**:
The sound a [[Ringing]] session makes: a ding every three seconds, unbounded, until [[Confirmation]]. It lives above the route, in the root layout beside the sync engine, so a session that ends while the user is on the landing page or a profile still reaches them. Scheduled on the audio clock rather than a timer, because hidden tabs throttle timers to about one callback a minute — which is exactly the case it exists for. It cannot be heard after a page reload until the user next touches the device: browsers destroy the audio context with the document and will not rebuild one without a gesture.
_Avoid_: chime, ding (that is one tone of it), notification (that is the OS-level one, fired once per ring)

**Content frame**:
The page-level visual container: a centered column (max-w-lg) with thin left/right borders on `md+` screens, surrounded by a dark stone background on desktop. Borders and stone background are hidden on mobile, leaving a flush black surface. The frame fills the viewport at minimum (`min-h-screen`).
_Avoid_: page wrapper, layout shell

### Copy

**Copy**:
All user-facing text — UI labels, notifications, server error messages, metadata — written in extremely casual Gen-Z Persian and centralized in one JSON file. Repo docs (README, SPEC) are not copy and stay formal.
_Avoid_: strings, labels, i18n messages

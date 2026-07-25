# Pomodorus

A minimal Persian-language pomodoro app with a realtime global activity feed, public profiles, and a public landing page.

## Language

### Identity

**Username**:
A user's unique, immutable, URL-safe public handle (lowercase latin letters, digits, underscore). The only public identity: shown in the feed, on profiles, and in profile URLs. There is no separate display name.
_Avoid_: handle, slug, display name (removed concept)

**Email**:
The private login credential. Never exposed publicly; not a username.

### Pages

**Landing**:
The public root page anyone (signed-in or not) sees: minimal text plus the live feed.
_Avoid_: home, welcome page

**Timer app**:
The signed-in working surface where sessions are started and run.
_Avoid_: profile, dashboard

**Profile**:
A public, read-only page for one user: their identity plus their daily focus history. Publicly accessible without signing in.
_Avoid_: history page (the profile subsumed it), account page

### Timer

**Category**:
A user-defined label attached to work sessions (e.g. "درس", "کار"). Public categories show their name in the feed; private ones show as a private task. Owned by one user; not shared. User-facing copy calls it "تسک" (casual register, like "چیل" for break); code and docs say category.
_Avoid_: task, tag, project (in code and docs)

**Session**:
One timed run — work or break — with a nominal duration. Owned by the device that runs it (local-first): it starts, completes, and is credited locally, then is reported to the server. Completed work sessions from every device all count; there is no one-running-session-per-user rule.
_Avoid_: server-authoritative session (the old model)

**Fast session**:
A dev-only session that completes after seconds of real time but is recorded and credited at its full nominal duration.
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

### Copy

**Copy**:
All user-facing text — UI labels, notifications, server error messages, metadata — written in extremely casual Gen-Z Persian and centralized in one JSON file. Repo docs (README, SPEC) are not copy and stay formal.
_Avoid_: strings, labels, i18n messages

# Pomodorus

A minimal Persian-language pomodoro app with a realtime global activity feed, public profiles, and a public landing page.

## Language

### Identity

**Username**:
A user's unique, immutable, URL-safe public handle (lowercase latin letters, digits, underscore). Identifies the user in public profile URLs.
_Avoid_: handle, slug

**Display name**:
The non-unique human-readable name a user shows in the feed and on their profile. Not an identifier.
_Avoid_: name (ambiguous), nickname

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
One timed run — work or break — with a nominal duration. Server-authoritative; completes when its end time passes.

**Fast session**:
A dev-only session that completes after seconds of real time but is recorded and credited at its full nominal duration.
_Avoid_: test session, mock session

**Chill (چیل)**:
The casual-register term for a break in user-facing copy. The domain concept is still "break".

### Copy

**Copy**:
All user-facing text — UI labels, notifications, server error messages, metadata — written in extremely casual Gen-Z Persian and centralized in one JSON file. Repo docs (README, SPEC) are not copy and stay formal.
_Avoid_: strings, labels, i18n messages

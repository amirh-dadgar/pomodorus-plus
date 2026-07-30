# Local-first timer; Convex is a log, not the source of truth

Pomodorus must be fully functional offline as an installable PWA. A server-authoritative timer (the original model: the session is a Convex row, completion happens when the server-recorded end time passes, one running session per user enforced server-side) cannot run without a network, so we inverted it: the device that runs a session owns it — start, countdown, completion, break auto-start, and cycle counting are all local — and Convex records completed sessions after the fact, whenever the device is next online.

## Consequences

- The one-running-session-per-user invariant is dropped. Completed sessions from every device all count, with no dedup; a two-device user can double-count focus time. Accepted — casual app, no leaderboard stakes.
- The feed shows **presence**, not truth: a best-effort advertisement published when online, self-expiring at the session's end time. It can be stale for up to one session length (offline cancel) or appear late (offline start, reconnect mid-session).
- "A session completes even with no tab open" now means it is finalized retroactively on next launch, not at the moment the end time passes.
- Notifications fire from local completion, so they work offline.
- Offline use requires having signed in once on the device; an expired auth token never blocks the timer — unsynced data is held and syncs after re-login.
- Category edits sync last-write-wins (delete beats rename, duplicate names tolerated). Conflicts cannot lose focus time: a delete tombstones the category rather than removing it, keeping its name, and session rows keep pointing at it.

## Considered options

- **Keep server-authoritative, offline as a fallback mode** — rejected: two timer state machines and a hairy handoff on every network transition.
- **Offline as read-only cache** — rejected: fails the requirement outright.

## Amendment, 2026-07-30

The consequence above originally read "history is daily aggregates independent of category", and this decision kept a `dailyStats` table of per-day totals alongside the sessions log to deliver that. Two things made it dead weight: the category tombstone already gives the property, and `profiles.chart` derives every total from the sessions log directly so that a day detail always sums to the chart line. Nothing ever read the aggregates. The table, its `by_user_day` index and the maintenance in `sync.push` are gone — the sessions log is the single source of daily totals. Pre-existing rows are simply left unread.

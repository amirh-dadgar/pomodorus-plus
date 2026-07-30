# Today's focus on the timer screen is read from the server

The timer's start screen shows how much focus the current Tehran day already holds — a count of completed work sessions and their total. ADR 0001 says `/app` runs from local data, so the obvious source is the device. It cannot be: `LocalState` keeps completed sessions only in `pendingSessions`, the queue of things not yet reported, and `markSynced` drops them the moment sync succeeds. A total summed from local state would count up during a session and then fall back to zero as soon as the device reconnected — worse than showing nothing.

The alternative was to add a per-day accumulator to the device (`{ dayKey, count, totalMs }`, incremented in `apply()` and reset on the Tehran day rollover). That would have been genuinely offline and O(1), but it counts only the device it lives on, so the number would disagree with the same day on the user's own profile. This one line is a summary of the user's day, not of this browser's day, so it comes from `sessions.todayFocus` instead.

## Consequences

- The timer screen has exactly one element that needs the network. Everything that makes the timer a timer — starting, counting down, completing, breaks, cycles, categories — is still local, so ADR 0001's guarantee is intact in substance.
- The line has three ways of having no number: signed out, still loading, and offline. All three render as a blank row of fixed height. Only a total the server actually confirmed may render «امروز تمرکز نکردی کلا» — an offline user who just finished two sessions must never be told they focused nothing, which is precisely the lie the local-first design exists to avoid.
- Because the row holds its height in every state, the number arriving does not move the Start button.
- The query is a full scan of the user's completed sessions, like `profiles.chart`. Volumes are tiny and pre-migration rows may lack `endedAt`, so an index on end time would not simplify it.

## Considered options

- **Local per-day accumulator** — rejected above: device-local totals disagree with the profile.
- **Server total plus unsynced local sessions on top** — rejected: two sources to reconcile for one line of text, and it still has nothing to show on a cold offline load.
- **Drop the line** — rejected: the copy was already written (`timer.todaySummary`, `timer.todayEmpty`) and the start screen was two controls and nothing else.

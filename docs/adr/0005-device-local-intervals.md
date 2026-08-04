# The intervals are configurable, and they belong to the device

The timer's durations were two constants and a hard-coded pair of work lengths: 25 or 55 minutes, a 5-minute short break, a 20-minute long break, and a long break every 4th pomodoro. They are now four settings — work, short break, long break, and pomodoros-per-cycle — each clamped to a band, defaulting to 25/5/20/4.

Two things had to be decided: how free the numbers are, and whose they are.

**How free.** "Configurable" and "faithful to the Pomodoro technique" are in tension: 25/5/15–30-every-4 is not a suggested starting point, it is the mechanism. Presets only — pick a named scheme — would have been maximally faithful, and deriving the breaks from the work length by the technique's own ratios would have reproduced 25/5/20 exactly from a single number. Both were rejected because neither gives configurable *rest* time, which was half the requirement. Instead all four are free within technique-anchored bands (work 15–60 by 5, short 3–15, long 10–35 by 5, cycle 2–6), with the classic values as the defaults and named as such in the settings copy. The accepted cost is stated plainly: the app can be configured into something that is no longer the Pomodoro technique.

`55` accordingly stops being a blessed value. It was never Pomodoro anyway — it is the 55/10 ultradian variant from a different school — and the 5-minute grid from 15 contains it, so nothing is lost but its special status.

**Whose.** Device-local, in `LocalState`, never synced. ADR 0001 already says the device owns the timer, and these durations *are* the timer. Syncing them would buy a new pending-op queue, last-write-wins rules, and a genuinely bad failure mode — a phone pushing a change that alters a laptop's pomodoro length mid-cycle — to save a twenty-second setup performed once per device.

## Consequences

- **A phone and a laptop can disagree about what a pomodoro is**, and the sessions log will contain both. Already true of the old 25/55 split; the range widens it.
- `RANGES.work.max` is coupled to `MAX_SESSION_MS` in `lib/presence.ts`, which refuses to advertise anything longer than 60 minutes. A 60-minute session passes on the boundary. Raise the ceiling without moving that constant and the feed silently drops the session — no error, the user simply vanishes. Both sites carry a comment.
- **A pomodoro carries its own break lengths**, snapshotted onto the running session at start, so editing settings mid-session or mid-ring cannot change the break it hands you. Every completed session was governed by the numbers on screen when Start was pressed.
- **Pomodoros-per-cycle is the exception**: it describes the cycle rather than any one session, so it is read at completion and applies immediately. Drop it from 4 to 3 while sitting on 3 dots and the next completion earns the long break, which is what someone making that change wants.
- SPEC's "**No settings page**" is now false. The breaks and cycle length live in a dialog off the start screen; the work length stays on the start screen, where it genuinely is a per-session decision, as the same − / + pair that used to toggle 25 ↔ 55.
- The picked task and the chosen length moved out of React state into the persisted blob, so a reload no longer loses them. This was a standing bug, not a consequence — the session survived a refresh but the selection around it did not.
- Migration is free: `loadState()` spreads over `EMPTY_STATE`, so existing blobs pick up the defaults. The storage key stays `v1:`; bumping it would destroy unsynced sessions.

## Considered options

- **Preset schemes only** — rejected: every reachable configuration would be a real documented method, but rest time would not be configurable.
- **Set the pomodoro length, derive the breaks from it** — rejected for the same reason, despite reproducing today's numbers exactly from one input.
- **Sync settings per user** — rejected above: a queue, conflict rules and a cross-device failure mode, for a payoff felt once per device.
- **Local, seeded from the server on first sign-in** — rejected: the same machinery plus a "which wins on first load" question.

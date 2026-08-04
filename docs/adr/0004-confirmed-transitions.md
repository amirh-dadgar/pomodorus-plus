# A session never advances on its own — it rings until it is confirmed

Every transition in the timer used to happen on a timestamp. `settled()` walked a chain: a work session whose end time had passed completed, its break auto-started from that exact moment, and if the break was over too, that finished as well. Nothing needed a person. That is what the SPEC meant by "breaks auto-start when a work session completes".

The failure it produced is that the app moves on without you. Step away for a coffee at minute 24 and you come back to an app that has finished your pomodoro, run your five-minute break and gone idle — with one chime you never heard. The mechanism the technique depends on is that *you* mark the end of a pomodoro and *you* take the break; an app that does both silently has removed the user from their own cycle.

So sessions now end into a **ringing** state and stop. A ring alarms every three seconds, unbounded, and only an explicit tap ends it.

The hard part was what that does to the numbers, because "keep the timer going until I confirm" and "be extremely accurate to the Pomodoro technique" pull against each other. Cirillo's pomodoro is *indivisible*: it is over when the bell rings, and working past the bell is a violation, not dedication. If ring time were credited as focus, a tab left open overnight would fabricate eight hours of it and the interval would stop being a fixed unit.

**Ring time is therefore not focus time.** A work session is complete and credited at its exact nominal end, at its full nominal duration, before anyone taps anything — and it syncs from there, without waiting to be acknowledged. Whether you confirm in two seconds or two hours, your history is identical.

What ring time *does* affect is the break. Ringing for forty minutes means forty minutes away from the desk, which was rest whether or not it was labelled as such. So the break is anchored at the nominal end and the ring is spent out of it: confirm after ten seconds and the break is `5:00 − 0:10`; confirm after forty minutes and there is no break left to take. One rule at every ring length, with no threshold to justify, and it refuses to hand you rest you have already had.

## Consequences

- `settled()` no longer chains. At most one transition is ever due, however long the app was closed, because a ring is terminal until a command clears it.
- A ringing session has **no cancel**. Cancel voids a session that has earned nothing yet; by the time one is ringing it is complete, credited and quite possibly already on the server. Retracting it would mean a completed session can be un-completed after sync, which is a different data model.
- **`lastActivityAt` is stamped at the bell, never at confirmation.** A three-hour ring therefore trips the existing one-hour idle reset and abandons the cycle — which is right, since three hours of not working is not one sitting. It also means a long ring cannot be used to keep a cycle alive indefinitely.
- **Audibility is decided once, when the ring is born, and never revisited.** Within a minute of the bell the app was there to hear it, so the ring is audible and stays audible for as long as it takes. Later than that, it is a ring being discovered on a launch long afterwards: the state is identical but it is silent for good. Judging staleness continuously would either kill an ordinary ring after a minute or sound a siren for something that ended yesterday.
- The alarm moved out of the timer screen into a headless component in the root layout, beside the `SyncEngine`. A session that ends while you are on the landing page has to reach you. The NavBar badge stays through a ring for the same reason, counting *up* rather than down — filled and belled rather than outlined, since the inversion has to be legible at a glance.
- Dings are scheduled on the **WebAudio clock**, not `setInterval`. Hidden tabs clamp timers to roughly one callback a minute, which is exactly the case the alarm exists for. The audio thread is not throttled, so the schedule is filled two minutes ahead and topped up on an interval that may be starved without the alarm missing a beat.
- **A reload silences a live alarm until the next interaction.** The `AudioContext` dies with the document and browsers will not rebuild one without a gesture. Mitigated by re-unlocking on the first pointer or key event anywhere in the app, but it is why the ring screen and the badge must carry the message without sound.
- Presence still expires at the session's end time, so a ringing user leaves the feed at the bell. Correct under this model — they are not working — and it needed no server change.
- **Today's focus ticks up at the bell**, before confirmation, since the session is already credited and synced. Visible, and honest.

## Considered options

- **Credit ring time as focus** — rejected: it makes every pomodoro a different length, abandons the fixed interval the technique runs on, and lets an unattended tab invent enormous totals.
- **Credit ring time up to a cap** — rejected: still non-uniform units, plus a magic number, and discontinuous either side of it.
- **Always give a full break regardless of ring length** — rejected: hands a full break to someone back from lunch, and makes walking away strictly better than following the technique.
- **A threshold: full break under it, none over** — rejected: a cliff where a slope works, and the number would have been arbitrary.
- **Let any interaction confirm** — rejected: alt-tabbing back at 25:01 would silently start the break, which is the same invisible transition this decision exists to remove, moved to a different trigger.
- **Resolve stale rings silently to idle** — rejected: a second code path in `settled()`, and it discards the screen where continuing the previous task naturally lives.

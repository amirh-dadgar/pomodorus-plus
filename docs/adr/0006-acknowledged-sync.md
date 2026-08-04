# A device forgets a session only when the server says it has one

`sync.push` has always been forgiving in the wrong direction. It validates every item a device uploads, `continue`s past anything it does not like, and returns nothing. The client's half of the contract was written to match: on a resolved promise, clear the whole queue.

```ts
push({ sessions: pendingSessions, categoryOps: pendingCategoryOps })
  .then(() => markSynced(pendingSessions, pendingCategoryOps))
```

So "the server rejected this" and "the server stored this" were the same event on the device, and both of them deleted the only copy. A rejection was not a failure anybody could see — no error, no retry, no row. The pomodoro was simply gone, and the user found out by looking at a chart that disagreed with their afternoon.

The reachable path that made this a real incident rather than a theoretical one is the clock skew check:

```ts
if (s.endedAt > now + CLOCK_SKEW_MS) continue; // no future-dated credit
```

Session timestamps are minted from `Date.now()` on the device. A machine whose clock runs more than five minutes ahead of the server's therefore dates *every* session it will ever complete into the future, and every one of them is dropped and then cleared. Not an unlucky session — all of them, for as long as the clock is wrong, on a device where the app otherwise looks like it is working perfectly. Wrong device clocks are common and users do not know they have one.

The two batch caps did the same thing more quietly. `sessions.slice(0, 500)` bounds the work one mutation does, which is sound; the client then cleared all 900 items it had sent, which is not. The exact users this cost were the ones the local-first design is *for* — a long spell offline is the case where the queue gets long.

## The rule

**A device may forget a queued item only when the server names it.** `push` returns an ack:

```ts
export type PushAck = {
  sessions: string[];    // clientIds
  categoryOps: string[]; // `clientId:at` keys
};
```

and `markSynced` clears the intersection of the queue with that ack, never the payload. Silence about an item means it is still the device's problem — it stays queued and goes again next round.

That forces the server to say which of its two nos it means:

- **Never storable.** A duration off the interval grid, a non-finite timestamp, a `devFast` session on a deployment that does not take them, an end time that does not match its own start plus duration. All of these are properties of the payload; retrying cannot change them, and the pending queue is hand-editable localStorage, so some of them are simply forged. These are acked and dropped, exactly as before — the difference is that it is now a decision the server states rather than an accident of the client's bookkeeping.
- **Not storable yet.** Dated ahead of the server's clock, or past the batch cap. Nothing is wrong with the session; the world is not ready for it. These are left off the ack, and the device keeps offering them. A clock five minutes fast now costs a session five minutes of latency instead of its existence, and a 900-item backlog drains in two round trips.

Idempotency is what makes waiting free: sessions are deduped by client-minted `clientId`, so an item that was in fact stored — and whose ack was lost with the connection — is recognized on the retry and acked then.

The verdict lives in `lib/sync-rules.ts` as a pure function of the payload, the clock and the deployment's fast-session policy. The mutation around it is covered separately by `convex-test` against an in-memory backend (`tests/sync-push.test.ts`), which is what pins down the parts that need a database to be true at all: dedupe across retries, last-write-wins, tombstones, the batch cap, and the fact that one user's queue cannot reach another's log.

## Ask the payload before you ask the clock

`verdictFor` answers every question it can from the payload alone, and consults the clock last. That ordering is load-bearing, and a test found it the hard way: deferring is a promise that time will fix this, so anything time cannot fix has to be settled before the promise is made.

A forged duration is the case that proves it. A hand-edited ten-hour "pomodoro" starting an hour ago ends *nine hours in the future*, so a skew check placed first sees a future-dated session and defers it — and the server then politely carries a forgery on the device's queue until that hour arrives, at which point it rejects it anyway. Checking self-consistency first means only sessions that are sound in every other respect are ever deferred.

The same reasoning covers a non-finite `endedAt`: `Infinity` is in the future by every comparison, so a defer would park it forever. It is rejected before the clock is consulted at all.

## Consequences

- **`markSynced` takes ids, not rows.** The command is `{ sessionIds, opKeys }`. It was already keying category ops by `clientId:at` so that an edit made after the push went out survives; that key is now the wire format.
- **A wholly unacknowledged push schedules a retry.** A partial ack shrinks the queue, which re-runs the drain effect on its own. An ack that names nothing changes no state, so nothing would wake the engine up; that case falls back to the same 15-second timer a network failure uses. A push wanted while one is already in flight is remembered and taken when it lands, rather than waiting for the next thing that happens to change the queue.
- **A long backlog can head-of-line block.** Only the first `SESSION_BATCH` items are examined, so if all of them defer, valid items behind them wait too. Deferral is temporary by construction — the clock catches up, and rejects drain — so this resolves itself, and it costs latency rather than data.
- **The queue can now hold an item indefinitely** — a device whose clock is an hour fast keeps its sessions for an hour. That is the trade the rule buys, and it is the right one: a session waiting in localStorage is recoverable, a session dropped is not. The permanent-rejection branch is what stops the queue growing without bound on garbage.
- **Old clients against a new server are unaffected** (they ignore the return value and clear everything, which is the previous behaviour). A new client against an old server would clear nothing and retry forever, so the deployment order is server first — which is how this repo deploys anyway.

## Considered options

- **Clamp future-dated sessions to the server's clock instead of deferring them.** Rejected: it silently rewrites history, and since days are bucketed Tehran-local, a clamp can move a session onto the wrong day. Deferring keeps the device's own account of when it worked.
- **Widen the skew tolerance.** Rejected as a fix, though the number is still debatable: any finite tolerance has a device just outside it, and the failure at that edge was total and silent. The ack removes the cliff rather than moving it.
- **Fail the whole mutation on the first invalid item.** Rejected: one forged row in the queue would block every good row behind it forever, which is the same data loss with extra steps.
- **Have the client validate before pushing, so nothing is ever rejected.** Rejected as a substitute — the client already applies these rules, and the server re-checks precisely because localStorage is editable. Worth doing as belt-and-braces; useless as the guarantee.

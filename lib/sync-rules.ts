// What the server does with a session a device reports, as one pure function.
//
// This is the hinge the whole sync protocol turns on
// (docs/adr/0006-acknowledged-sync.md): the difference between "drop this" and
// "not yet" is the difference between losing someone's afternoon and costing
// them a round trip. It lives here, away from the database, so every branch of
// it can be exercised as data — `convex/sync.ts` supplies the clock, the
// deployment's fast-session policy, and the one check that needs a query.

import { isWorkDurationMs } from "./local/types";

/** A completed work session as a device reports it. */
export type SessionReport = {
  clientId: string;
  categoryClientId?: string;
  startedAt: number;
  durationMs: number;
  endedAt: number;
  devFast?: boolean;
};

/**
 * - `store` — log it.
 * - `defer` — nothing is wrong with it and nothing is wrong with the device;
 *   the server just cannot take it *yet*. Left unacknowledged, so it stays on
 *   the device's queue and comes back next push.
 * - `reject` — no future push can make this storable. Acknowledged, so the
 *   device stops carrying it.
 *
 * `defer` is the option that did not exist before, and the one that matters:
 * every rejection used to be permanent, and the device deleted its only copy
 * of anything rejected.
 */
export type Verdict = "store" | "defer" | "reject";

const MINUTE_MS = 60_000;

/**
 * How far ahead of the server a device's clock may be and still be believed.
 *
 * Timestamps are minted from the device's own `Date.now()`, so a machine whose
 * clock runs fast dates its sessions in the future. That is the device being
 * wrong about the time, not the user being wrong about their afternoon.
 */
export const CLOCK_SKEW_MS = 5 * MINUTE_MS;

/** How closely a real session's end must match its own start plus duration. */
const END_TOLERANCE_MS = 1000;

export function verdictFor(
  s: SessionReport,
  opts: { now: number; fastAllowed: boolean },
): Verdict {
  // Every question that can be answered from the payload alone is answered
  // first, and the clock is consulted last. Order matters, and not only for
  // tidiness: deferring is a promise that time will fix this, so anything the
  // passage of time cannot fix has to be out of the way before we make it.
  // A forged ten-hour duration, for instance, dates its own end nine hours out
  // — ask the clock first and the server politely waits nine hours for a
  // session it was always going to refuse.
  if (!Number.isFinite(s.startedAt) || !Number.isFinite(s.endedAt)) return "reject";

  // The device decides the intervals (ADR 0005), so this can only check the
  // range they are drawn from — the pending queue is editable localStorage,
  // and a hand-edited 10-hour "pomodoro" must not be credited.
  if (!isWorkDurationMs(s.durationMs)) return "reject";

  if (s.devFast) {
    // A deployment that does not take fast sessions will never take this one,
    // and its real elapsed time is seconds, so the end-time check below cannot
    // apply to it — only that it ran forwards.
    if (!opts.fastAllowed || s.endedAt < s.startedAt) return "reject";
  } else if (Math.abs(s.endedAt - (s.startedAt + s.durationMs)) > END_TOLERANCE_MS) {
    // A real session ends exactly when its duration elapses; anything else was
    // not produced by the timer.
    return "reject";
  }

  // Sound in every respect but one: it is dated ahead of this server's clock.
  // The only rejection that is not the payload's fault, so the only one that
  // gets to wait. Waiting is free because sessions dedupe on their
  // client-minted id, so the retry that eventually lands cannot double-credit.
  if (s.endedAt > opts.now + CLOCK_SKEW_MS) return "defer";

  return "store";
}

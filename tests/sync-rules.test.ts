import test from "node:test";
import assert from "node:assert/strict";
import { CLOCK_SKEW_MS, verdictFor, type SessionReport } from "../lib/sync-rules";
import { MINUTE_MS, RANGES } from "../lib/local/types";

const NOW = 1_000_000_000_000;
const WORK_MS = 25 * MINUTE_MS;

/** A session the timer could really have produced, ending an hour ago. */
const session = (over: Partial<SessionReport> = {}): SessionReport => {
  const startedAt = NOW - 60 * MINUTE_MS;
  return {
    clientId: "s1",
    startedAt,
    durationMs: WORK_MS,
    endedAt: startedAt + WORK_MS,
    ...over,
  };
};

const verdict = (s: SessionReport, now = NOW, fastAllowed = false) =>
  verdictFor(s, { now, fastAllowed });

test("an ordinary completed pomodoro is stored", () => {
  assert.equal(verdict(session()), "store");
});

test("every length on the work grid is storable", () => {
  const { min, max, step } = RANGES.work;
  for (let minutes = min; minutes <= max; minutes += step) {
    const startedAt = NOW - 2 * 60 * MINUTE_MS;
    const s = session({
      durationMs: minutes * MINUTE_MS,
      startedAt,
      endedAt: startedAt + minutes * MINUTE_MS,
    });
    assert.equal(verdict(s), "store", `${minutes} minutes`);
  }
});

// ---- Deferred: nothing is wrong with the session, only with the clock ----

// The incident behind ADR 0006. A device whose clock runs fast dates every
// session it will ever complete into the future; when that was a rejection and
// the device cleared whatever it had sent, the user lost all of them.
test("a session from a clock running fast is deferred, never rejected", () => {
  const startedAt = NOW + 30 * MINUTE_MS; // device thinks it is half an hour later
  const s = session({ startedAt, endedAt: startedAt + WORK_MS });
  assert.equal(verdict(s), "defer");
});

test("a deferred session stores once the server's clock catches up", () => {
  const startedAt = NOW + 30 * MINUTE_MS;
  const s = session({ startedAt, endedAt: startedAt + WORK_MS });
  // Same payload, an hour of real time later.
  assert.equal(verdict(s, NOW + 60 * MINUTE_MS), "store");
});

test("skew within tolerance is stored, and just past it is deferred", () => {
  // Self-consistent either side of the line, so the clock is the only
  // difference between them.
  const at = (endedAt: number) =>
    session({ startedAt: endedAt - WORK_MS, endedAt, durationMs: WORK_MS });
  assert.equal(verdict(at(NOW + CLOCK_SKEW_MS - 1)), "store");
  assert.equal(verdict(at(NOW + CLOCK_SKEW_MS + 1)), "defer");
});

// A forged payload must not be able to park itself on the queue: an absurd
// duration dates its own end into the future, and deferring would mean
// carrying it until that hour arrives.
test("a forged session is rejected outright, not deferred until its fake end", () => {
  const startedAt = NOW - 60 * MINUTE_MS;
  const tenHours = 10 * 60 * MINUTE_MS;
  const s = session({ startedAt, durationMs: tenHours, endedAt: startedAt + tenHours });
  assert.ok(s.endedAt > NOW + CLOCK_SKEW_MS, "the fixture must look future-dated");
  assert.equal(verdict(s), "reject");
});

// ---- Rejected: no later push can make these storable ----

test("an end time that is not a real moment is rejected, not deferred", () => {
  // Infinity is "in the future" by every comparison, so a defer here would
  // park the item on the queue forever.
  assert.equal(verdict(session({ endedAt: Infinity })), "reject");
  assert.equal(verdict(session({ endedAt: NaN })), "reject");
  assert.equal(verdict(session({ startedAt: Infinity })), "reject");
});

test("a duration off the work grid is rejected", () => {
  const startedAt = NOW - 60 * MINUTE_MS;
  for (const durationMs of [
    10 * 60 * MINUTE_MS, // the hand-edited ten-hour "pomodoro"
    22 * MINUTE_MS, // a real length, but not a stop on the grid
    WORK_MS + 1, // not a whole number of minutes
    0,
    -WORK_MS,
  ]) {
    const s = session({ durationMs, startedAt, endedAt: startedAt + durationMs });
    assert.equal(verdict(s), "reject", `${durationMs}ms`);
  }
});

test("a session that did not end when its duration elapsed is rejected", () => {
  const startedAt = NOW - 60 * MINUTE_MS;
  assert.equal(
    verdict(session({ startedAt, endedAt: startedAt + WORK_MS + 5000 })),
    "reject",
  );
  // A second of slack is tolerated; the timer is not to the millisecond.
  assert.equal(
    verdict(session({ startedAt, endedAt: startedAt + WORK_MS + 900 })),
    "store",
  );
});

test("a fast session is rejected unless the deployment takes them", () => {
  // Its real elapsed time is seconds, so it fails the end-time check that
  // guards ordinary sessions — the whole point of the flag.
  const startedAt = NOW - 60 * MINUTE_MS;
  const s = session({ startedAt, endedAt: startedAt + 3000, devFast: true });
  assert.equal(verdict(s, NOW, false), "reject"); // production
  assert.equal(verdict(s, NOW, true), "store"); // DEV_FAST_POMODORO set
});

test("a fast session that ends before it starts is rejected even where they are allowed", () => {
  const startedAt = NOW - 60 * MINUTE_MS;
  const s = session({ startedAt, endedAt: startedAt - 1, devFast: true });
  assert.equal(verdict(s, NOW, true), "reject");
});

// ---- The property the protocol depends on ----

test("no verdict is ever silently lost: every session is stored, deferred, or rejected", () => {
  const cases: SessionReport[] = [
    session(),
    session({ endedAt: Infinity }),
    session({ durationMs: 0 }),
    session({ startedAt: NOW + 10 * MINUTE_MS, endedAt: NOW + 35 * MINUTE_MS }),
    session({ devFast: true }),
  ];
  for (const s of cases) {
    assert.ok(["store", "defer", "reject"].includes(verdict(s)));
  }
});

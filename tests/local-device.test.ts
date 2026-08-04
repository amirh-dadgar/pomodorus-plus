import test from "node:test";
import assert from "node:assert/strict";
import {
  apply,
  breakAfterRing,
  effectiveCategories,
  normalizeServerCategories,
  type Command,
  type Env,
} from "../lib/local/device";
import {
  AUDIBLE_WINDOW_MS,
  DEFAULT_SETTINGS,
  EMPTY_STATE,
  FAST_MS,
  IDLE_RESET_MS,
  MINUTE_MS,
  type LocalState,
} from "../lib/local/types";
import { copy } from "../lib/copy";

const T0 = 1_000_000_000_000;
const SHORT_BREAK_MS = DEFAULT_SETTINGS.shortBreakMinutes * MINUTE_MS;
const LONG_BREAK_MS = DEFAULT_SETTINGS.longBreakMinutes * MINUTE_MS;

/** A deterministic env: fixed clock, counted ids. */
function env(now: number): Env {
  let n = 0;
  return { now, newId: () => `id${++n}` };
}

/** Run one command at `now`, from `state`. */
const at = (now: number, state: LocalState, command: Command) =>
  apply(state, command, env(now));

/** Idle, with a task picked so `startWork` has something to run on. */
const idle = (over: Partial<LocalState> = {}): LocalState => ({
  ...EMPTY_STATE,
  selectedCategoryId: "cat1",
  ...over,
});

/** A 25-minute work session started at T0, on category `cat1`. */
const working = (over: Partial<LocalState> = {}): LocalState => ({
  ...EMPTY_STATE,
  selectedCategoryId: "cat1",
  running: {
    id: "w1",
    kind: "work",
    categoryClientId: "cat1",
    startedAt: T0,
    durationMs: 25 * MINUTE_MS,
    shortBreakMs: SHORT_BREAK_MS,
    longBreakMs: LONG_BREAK_MS,
  },
  ...over,
});

const onBreak = (
  kind: "shortBreak" | "longBreak",
  over: Partial<LocalState> = {},
): LocalState => ({
  ...EMPTY_STATE,
  selectedCategoryId: "cat1",
  running: {
    id: "b1",
    kind,
    categoryClientId: null,
    startedAt: T0,
    durationMs: kind === "longBreak" ? LONG_BREAK_MS : SHORT_BREAK_MS,
  },
  ...over,
});

/** Settle `state` far enough past T0 that its session has rung for `ringMs`. */
const ringFor = (state: LocalState, endsAt: number, ringMs: number) =>
  at(endsAt + ringMs, state, { type: "settle" }).state;

// ---- Starting work ----

test("starting work runs a session at the configured length", () => {
  const { state, rejected } = at(T0, idle(), { type: "startWork", fast: false });
  assert.equal(rejected, undefined);
  assert.equal(state.running?.kind, "work");
  assert.equal(state.running?.durationMs, 25 * MINUTE_MS);
  assert.equal(state.running?.startedAt, T0);
  assert.equal(state.running?.categoryClientId, "cat1");
  assert.equal(state.running?.devFast, undefined);
});

test("the pomodoro length is whatever the stepper last set", () => {
  const { state: configured } = at(T0, idle(), {
    type: "setSetting",
    key: "work",
    value: 55,
  });
  const { state } = at(T0, configured, { type: "startWork", fast: false });
  assert.equal(state.running?.durationMs, 55 * MINUTE_MS);
});

test("a setting off its range's grid is refused", () => {
  for (const value of [0, 14, 26, 61, 90, -25, 2.5, Number.NaN]) {
    const { state, rejected } = at(T0, EMPTY_STATE, {
      type: "setSetting",
      key: "work",
      value,
    });
    assert.equal(rejected, copy.errors.badDuration, `${value} should be refused`);
    assert.equal(state.settings.workMinutes, DEFAULT_SETTINGS.workMinutes);
  }
  // Every stop on the grid is fine.
  for (const value of [15, 20, 25, 30, 45, 60]) {
    const { state, rejected } = at(T0, EMPTY_STATE, {
      type: "setSetting",
      key: "work",
      value,
    });
    assert.equal(rejected, undefined, `${value} should be accepted`);
    assert.equal(state.settings.workMinutes, value);
  }
});

test("the defaults are the classic technique", () => {
  assert.deepEqual(DEFAULT_SETTINGS, {
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 20,
    perCycle: 4,
  });
});

test("a fast session is credited at its nominal duration", () => {
  const { state } = at(T0, idle(), { type: "startWork", fast: true });
  assert.equal(state.running?.devFast, true);
  // Stored at 25 minutes, but really over after FAST_MS.
  assert.equal(state.running?.durationMs, 25 * MINUTE_MS);
  const { state: done } = at(T0 + FAST_MS, state, { type: "settle" });
  assert.equal(done.pendingSessions[0].durationMs, 25 * MINUTE_MS);
  assert.equal(done.pendingSessions[0].devFast, true);
});

test("a second session cannot start on top of a running one", () => {
  const { state, rejected } = at(T0 + MINUTE_MS, working(), {
    type: "startWork",
    fast: false,
  });
  assert.notEqual(rejected, undefined);
  assert.equal(state.running?.id, "w1");
});

test("nothing may start while a session is still ringing", () => {
  const ringing = ringFor(working(), T0 + 25 * MINUTE_MS, MINUTE_MS);
  const { state, rejected } = at(T0 + 26 * MINUTE_MS, ringing, {
    type: "startWork",
    fast: false,
  });
  assert.equal(rejected, copy.errors.confirmFirst);
  assert.equal(state.running, null);
});

test("work cannot start with no task picked", () => {
  const { rejected } = at(T0, EMPTY_STATE, { type: "startWork", fast: false });
  assert.notEqual(rejected, undefined);
});

// ---- Ringing ----

test("a session that ends starts ringing instead of advancing", () => {
  const { state } = at(T0 + 25 * MINUTE_MS, working(), { type: "settle" });
  assert.equal(state.running, null);
  assert.equal(state.ringing?.kind, "work");
  assert.equal(state.ringing?.id, "w1");
  assert.equal(state.ringing?.endedAt, T0 + 25 * MINUTE_MS);
  assert.equal(state.ringing?.categoryClientId, "cat1");
});

test("a ringing work session is already credited, at its exact end", () => {
  // No tap has happened, and the session is nonetheless complete and queued
  // for sync at its full nominal duration.
  const state = ringFor(working(), T0 + 25 * MINUTE_MS, 40 * MINUTE_MS);
  assert.equal(state.pendingSessions.length, 1);
  assert.equal(state.pendingSessions[0].endedAt, T0 + 25 * MINUTE_MS);
  assert.equal(state.pendingSessions[0].durationMs, 25 * MINUTE_MS);
  assert.equal(state.cycleCount, 1);
});

test("nothing chains: hours later there is still exactly one ring", () => {
  const state = ringFor(working(), T0 + 25 * MINUTE_MS, 8 * 60 * MINUTE_MS);
  assert.equal(state.running, null);
  assert.equal(state.ringing?.kind, "work");
  assert.equal(state.pendingSessions.length, 1);
});

test("audibility is decided when the ring is born, and never revisited", () => {
  const heard = ringFor(working(), T0 + 25 * MINUTE_MS, AUDIBLE_WINDOW_MS);
  assert.equal(heard.ringing?.audible, true);
  // Still audible an hour later: a ring the app was present for does not
  // give up just because it has gone unanswered.
  const later = at(T0 + 90 * MINUTE_MS, heard, { type: "settle" });
  assert.equal(later.state.ringing?.audible, true);

  // Discovered on a launch after the window: silent, for good.
  const missed = ringFor(working(), T0 + 25 * MINUTE_MS, AUDIBLE_WINDOW_MS + 1);
  assert.equal(missed.ringing?.audible, false);
});

// ---- Confirming ----

test("confirming starts the break, minus the ring", () => {
  const ringing = ringFor(working(), T0 + 25 * MINUTE_MS, MINUTE_MS);
  const { state } = at(T0 + 26 * MINUTE_MS, ringing, { type: "confirm" });
  assert.equal(state.ringing, null);
  assert.equal(state.running?.kind, "shortBreak");
  assert.equal(state.running?.startedAt, T0 + 26 * MINUTE_MS);
  assert.equal(state.running?.durationMs, SHORT_BREAK_MS - MINUTE_MS);
});

test("a ring longer than the break leaves no break to take", () => {
  const ringing = ringFor(working(), T0 + 25 * MINUTE_MS, 40 * MINUTE_MS);
  const { state } = at(T0 + 65 * MINUTE_MS, ringing, { type: "confirm" });
  assert.equal(state.ringing, null);
  assert.equal(state.running, null);
});

test("confirming does not reset the idle clock", () => {
  // The bell is what counts as the last activity, so a long ring is idleness
  // and the cycle's one-hour reset can still see it.
  const ringing = ringFor(working({ cycleCount: 2 }), T0 + 25 * MINUTE_MS, 90 * MINUTE_MS);
  const { state } = at(T0 + 115 * MINUTE_MS, ringing, { type: "confirm" });
  assert.equal(state.lastActivityAt, T0 + 25 * MINUTE_MS);
  const { state: next } = at(T0 + 116 * MINUTE_MS, state, {
    type: "startWork",
    fast: false,
  });
  assert.equal(next.cycleCount, 0);
});

test("a break that ends rings too", () => {
  const { state } = at(T0 + SHORT_BREAK_MS, onBreak("shortBreak", { cycleCount: 1 }), {
    type: "settle",
  });
  assert.equal(state.running, null);
  assert.equal(state.ringing?.kind, "shortBreak");
  assert.equal(state.ringing?.owedBreak, null);
  assert.equal(breakAfterRing(state.ringing!, T0 + SHORT_BREAK_MS), 0);
});

test("confirming a ringing break just goes idle", () => {
  const ringing = ringFor(onBreak("shortBreak", { cycleCount: 1 }), T0 + SHORT_BREAK_MS, 10);
  const { state } = at(T0 + SHORT_BREAK_MS + 10, ringing, { type: "confirm" });
  assert.equal(state.ringing, null);
  assert.equal(state.running, null);
  assert.equal(state.cycleCount, 1);
});

test("continue goes straight back to work on the same task", () => {
  const ringing = ringFor(onBreak("shortBreak", { cycleCount: 1 }), T0 + SHORT_BREAK_MS, 10);
  const { state, rejected } = at(T0 + SHORT_BREAK_MS + 10, ringing, {
    type: "continueWork",
    fast: false,
  });
  assert.equal(rejected, undefined);
  assert.equal(state.ringing, null);
  assert.equal(state.running?.kind, "work");
  assert.equal(state.running?.categoryClientId, "cat1");
  assert.equal(state.running?.durationMs, 25 * MINUTE_MS);
});

test("continue is only offered after a break, never after work", () => {
  const ringing = ringFor(working(), T0 + 25 * MINUTE_MS, 10);
  const { rejected } = at(T0 + 25 * MINUTE_MS + 10, ringing, {
    type: "continueWork",
    fast: false,
  });
  assert.equal(rejected, copy.errors.noRingingBreak);
});

test("there is nothing to confirm when nothing is ringing", () => {
  assert.equal(
    at(T0, EMPTY_STATE, { type: "confirm" }).rejected,
    copy.errors.nothingRinging,
  );
});

// ---- The cycle counter ----

test("the fourth completed session owes a long break", () => {
  const { state } = at(T0 + 25 * MINUTE_MS, working({ cycleCount: 3 }), {
    type: "settle",
  });
  assert.equal(state.cycleCount, 4);
  assert.equal(state.ringing?.owedBreak?.kind, "longBreak");
  assert.equal(state.ringing?.owedBreak?.durationMs, LONG_BREAK_MS);
});

test("earlier sessions owe a short break", () => {
  for (const cycleCount of [0, 1, 2]) {
    const { state } = at(T0 + 25 * MINUTE_MS, working({ cycleCount }), {
      type: "settle",
    });
    assert.equal(state.ringing?.owedBreak?.kind, "shortBreak");
    assert.equal(state.ringing?.owedBreak?.durationMs, SHORT_BREAK_MS);
    assert.equal(state.cycleCount, cycleCount + 1);
  }
});

test("break lengths ride on the session, so settings cannot change them mid-flight", () => {
  const started = working();
  // The user doubles their short break while the pomodoro runs.
  const { state: retuned } = at(T0 + MINUTE_MS, started, {
    type: "setSetting",
    key: "shortBreak",
    value: 10,
  });
  const { state } = at(T0 + 25 * MINUTE_MS, retuned, { type: "settle" });
  assert.equal(state.settings.shortBreakMinutes, 10);
  // ...and still gets the five minutes that were on screen when it started.
  assert.equal(state.ringing?.owedBreak?.durationMs, SHORT_BREAK_MS);
});

test("pomodoros-per-cycle is not snapshotted: it applies to the next completion", () => {
  const { state: retuned } = at(T0 + MINUTE_MS, working({ cycleCount: 2 }), {
    type: "setSetting",
    key: "perCycle",
    value: 3,
  });
  const { state } = at(T0 + 25 * MINUTE_MS, retuned, { type: "settle" });
  assert.equal(state.cycleCount, 3);
  assert.equal(state.ringing?.owedBreak?.kind, "longBreak");
});

test("the long break resets the cycle, taken or skipped", () => {
  const taken = at(T0 + LONG_BREAK_MS, onBreak("longBreak", { cycleCount: 4 }), {
    type: "settle",
  });
  assert.equal(taken.state.cycleCount, 0);

  const skipped = at(T0 + MINUTE_MS, onBreak("longBreak", { cycleCount: 4 }), {
    type: "skipBreak",
  });
  assert.equal(skipped.state.cycleCount, 0);
});

test("skipping a short break leaves the cycle where it was", () => {
  const { state } = at(T0 + MINUTE_MS, onBreak("shortBreak", { cycleCount: 2 }), {
    type: "skipBreak",
  });
  assert.equal(state.cycleCount, 2);
  assert.equal(state.running, null);
  assert.equal(state.lastActivityAt, T0 + MINUTE_MS);
});

test("an hour of idleness abandons the cycle on the way into the next session", () => {
  const stale = idle({ cycleCount: 3, lastActivityAt: T0 });
  const start = (now: number) =>
    at(now, stale, { type: "startWork", fast: false }).state.cycleCount;

  // Just inside the hour: the cycle survives.
  assert.equal(start(T0 + IDLE_RESET_MS), 3);
  // Past it: those sessions were never one cycle.
  assert.equal(start(T0 + IDLE_RESET_MS + 1), 0);
});

test("the idle hour runs from when the last break ended, not from the session", () => {
  // A short break ran T0 → T0+5 and was confirmed. Starting again at T0+60 is
  // 55 minutes after the device last did anything, so the cycle stands.
  const rung = ringFor(onBreak("shortBreak", { cycleCount: 1 }), T0 + SHORT_BREAK_MS, 10);
  const confirmed = at(T0 + SHORT_BREAK_MS + 10, rung, { type: "confirm" }).state;
  assert.equal(confirmed.lastActivityAt, T0 + SHORT_BREAK_MS);
  const { state } = at(T0 + 60 * MINUTE_MS, confirmed, {
    type: "startWork",
    fast: false,
  });
  assert.equal(state.cycleCount, 1);
  assert.equal(state.running?.kind, "work");
});

// ---- Cancelling and skipping ----

test("cancelling a work session credits nothing and leaves the cycle alone", () => {
  const { state } = at(T0 + 10 * MINUTE_MS, working({ cycleCount: 2 }), {
    type: "cancelWork",
  });
  assert.equal(state.running, null);
  assert.deepEqual(state.pendingSessions, []);
  assert.equal(state.cycleCount, 2);
  // Nothing ended naturally, so nothing should ring.
  assert.equal(state.ringing, null);
});

test("there is nothing to cancel on a break, or when idle", () => {
  assert.notEqual(at(T0, EMPTY_STATE, { type: "cancelWork" }).rejected, undefined);
  assert.notEqual(
    at(T0 + MINUTE_MS, onBreak("shortBreak"), { type: "cancelWork" }).rejected,
    undefined,
  );
});

test("a ringing session cannot be cancelled — it is already complete", () => {
  const ringing = ringFor(working(), T0 + 25 * MINUTE_MS, 10);
  const { state, rejected } = at(T0 + 25 * MINUTE_MS + 10, ringing, {
    type: "cancelWork",
  });
  assert.notEqual(rejected, undefined);
  assert.equal(state.pendingSessions.length, 1);
  assert.notEqual(state.ringing, null);
});

test("there is no break to skip during work, or when idle", () => {
  assert.notEqual(at(T0, EMPTY_STATE, { type: "skipBreak" }).rejected, undefined);
  assert.notEqual(at(T0 + MINUTE_MS, working(), { type: "skipBreak" }).rejected, undefined);
});

test("a cancel arriving after the end time still credits the session", () => {
  // The session was already over; cancelling cannot reach back and void it.
  const { state } = at(T0 + 30 * MINUTE_MS, working(), { type: "cancelWork" });
  assert.equal(state.pendingSessions.length, 1);
  assert.equal(state.pendingSessions[0].endedAt, T0 + 25 * MINUTE_MS);
});

// ---- Settling ----

test("a session mid-flight is left completely alone", () => {
  const state = working();
  // Same reference: nothing to persist, nothing to announce.
  assert.equal(at(T0 + 10 * MINUTE_MS, state, { type: "settle" }).state, state);
});

test("a session settled long after the fact is credited at its real end time", () => {
  const { state } = at(T0 + 8 * 60 * MINUTE_MS, working(), { type: "settle" });
  assert.equal(state.cycleCount, 1);
  assert.equal(state.pendingSessions.length, 1);
  // Credited at its real end time, not at the moment the app reopened.
  assert.equal(state.pendingSessions[0].endedAt, T0 + 25 * MINUTE_MS);
  assert.equal(state.pendingSessions[0].categoryClientId, "cat1");
});

test("a session from an older build still gets a break, from current settings", () => {
  // Persisted before break lengths were carried on the session.
  const legacy = working();
  delete legacy.running!.shortBreakMs;
  delete legacy.running!.longBreakMs;
  const { state } = at(T0 + 25 * MINUTE_MS, legacy, { type: "settle" });
  assert.equal(state.ringing?.owedBreak?.durationMs, SHORT_BREAK_MS);
});

// ---- The picked task ----

test("the picked task is remembered", () => {
  const { state } = at(T0, EMPTY_STATE, { type: "selectCategory", clientId: "cat9" });
  assert.equal(state.selectedCategoryId, "cat9");
  // Re-picking the same one changes nothing at all.
  assert.equal(at(T0, state, { type: "selectCategory", clientId: "cat9" }).state, state);
});

test("deleting the picked task unpicks it", () => {
  const state = idle({
    serverCategories: [{ clientId: "cat1", name: "یک", isPublic: true, updatedAt: 1 }],
  });
  const { state: next } = at(T0, state, { type: "deleteCategory", clientId: "cat1" });
  assert.equal(next.selectedCategoryId, null);
});

// ---- Categories ----

test("creating a category queues it and hands back its id", () => {
  const { state, created } = at(T0, EMPTY_STATE, {
    type: "createCategory",
    name: "  کد نویسی  ",
    isPublic: false,
  });
  assert.equal(created, "id1");
  assert.deepEqual(state.pendingCategoryOps, [
    { clientId: "id1", op: "upsert", name: "کد نویسی", isPublic: false, at: T0 },
  ]);
  assert.deepEqual(
    effectiveCategories(state).map((c) => c.name),
    ["کد نویسی"],
  );
});

test("a blank or overlong name is refused", () => {
  for (const name of ["", "   ", "ا".repeat(41)]) {
    const { state, created, rejected } = at(T0, EMPTY_STATE, {
      type: "createCategory",
      name,
      isPublic: true,
    });
    assert.equal(created, undefined);
    assert.notEqual(rejected, undefined);
    assert.deepEqual(state.pendingCategoryOps, []);
  }
  // Exactly at the limit is fine.
  assert.notEqual(
    at(T0, EMPTY_STATE, {
      type: "createCategory",
      name: "ا".repeat(40),
      isPublic: true,
    }).created,
    undefined,
  );
});

test("a profane name is refused, on the way in and on a rename", () => {
  const created = at(T0, EMPTY_STATE, {
    type: "createCategory",
    name: "سکس",
    isPublic: true,
  });
  assert.equal(created.created, undefined);
  assert.equal(created.rejected, copy.errors.categoryNameProfane);
  assert.deepEqual(created.state.pendingCategoryOps, []);

  // A clean category cannot be renamed into one either — which is the point of
  // checking here rather than only at creation.
  const state = at(T0, EMPTY_STATE, {
    type: "createCategory",
    name: "درس خوندن",
    isPublic: true,
  }).state;
  const renamed = at(T0 + 1, state, {
    type: "updateCategory",
    clientId: "id1",
    name: "کیری",
    isPublic: true,
  });
  assert.equal(renamed.rejected, copy.errors.categoryNameProfane);
  assert.equal(renamed.state.pendingCategoryOps[0].name, "درس خوندن");
});

test("a later edit replaces the queued one rather than stacking", () => {
  let state = at(T0, EMPTY_STATE, {
    type: "createCategory",
    name: "اول",
    isPublic: true,
  }).state;
  state = at(T0 + 1, state, {
    type: "updateCategory",
    clientId: "id1",
    name: "دوم",
    isPublic: false,
  }).state;
  assert.equal(state.pendingCategoryOps.length, 1);
  assert.equal(state.pendingCategoryOps[0].name, "دوم");
  assert.equal(state.pendingCategoryOps[0].isPublic, false);
});

test("a category cannot be edited out from under the session running on it", () => {
  const state = working(); // running on cat1
  for (const command of [
    { type: "updateCategory", clientId: "cat1", name: "تازه", isPublic: true },
    { type: "deleteCategory", clientId: "cat1" },
  ] as const) {
    const applied = at(T0 + MINUTE_MS, state, command);
    assert.notEqual(applied.rejected, undefined);
    assert.deepEqual(applied.state.pendingCategoryOps, []);
  }
  // A category the session is not on is fair game.
  assert.equal(
    at(T0 + MINUTE_MS, state, { type: "deleteCategory", clientId: "cat2" }).rejected,
    undefined,
  );
});

test("a category is editable again once its session is over", () => {
  // The session has ended, so the break — not the work — is what is running.
  const applied = at(T0 + 30 * MINUTE_MS, working(), {
    type: "deleteCategory",
    clientId: "cat1",
  });
  assert.equal(applied.rejected, undefined);
});

test("deleting hides a category the server still knows about", () => {
  const state: LocalState = {
    ...EMPTY_STATE,
    serverCategories: [{ clientId: "a", name: "یک", isPublic: true, updatedAt: 1 }],
  };
  const { state: next } = at(T0, state, { type: "deleteCategory", clientId: "a" });
  assert.deepEqual(effectiveCategories(next), []);
});

test("a newer server row wins over an older queued edit", () => {
  const state: LocalState = {
    ...EMPTY_STATE,
    serverCategories: [
      { clientId: "a", name: "سرور", isPublic: true, updatedAt: T0 + 10 },
    ],
    pendingCategoryOps: [
      { clientId: "a", op: "upsert", name: "قدیمی", isPublic: true, at: T0 },
    ],
  };
  assert.deepEqual(
    effectiveCategories(state).map((c) => c.name),
    ["سرور"],
  );
});

test("refreshing the server mirror with identical rows changes nothing", () => {
  const rows = [{ clientId: "a", name: "یک", isPublic: true, updatedAt: 1 }];
  const state: LocalState = { ...EMPTY_STATE, serverCategories: rows };
  // Same reference back: reconnect churn must not thrash storage.
  assert.equal(at(T0, state, { type: "setServerCategories", rows }).state, state);
});

// ---- Sync bookkeeping ----

test("marking synced clears exactly what was delivered", () => {
  const state: LocalState = {
    ...EMPTY_STATE,
    pendingSessions: [
      { clientId: "s1", startedAt: T0, durationMs: 25 * MINUTE_MS, endedAt: T0 + 1 },
      { clientId: "s2", startedAt: T0, durationMs: 25 * MINUTE_MS, endedAt: T0 + 2 },
    ],
    pendingCategoryOps: [
      { clientId: "a", op: "upsert", name: "یک", isPublic: true, at: T0 },
      // Edited again after the push went out: this one must survive.
      { clientId: "b", op: "upsert", name: "دو", isPublic: true, at: T0 + 5 },
    ],
  };
  const { state: next } = at(T0 + 10, state, {
    type: "markSynced",
    sessions: [state.pendingSessions[0]],
    ops: [
      state.pendingCategoryOps[0],
      // The version of "b" that was actually pushed, not the one queued since.
      { clientId: "b", op: "upsert", name: "دو", isPublic: true, at: T0 },
    ],
  });
  assert.deepEqual(
    next.pendingSessions.map((s) => s.clientId),
    ["s2"],
  );
  assert.deepEqual(
    next.pendingCategoryOps.map((o) => o.at),
    [T0 + 5],
  );
});

// ---- Reading the category cache ----

// Regression for the 2026-07-25 incident: the new client against a stale
// backend whose categories.list returned raw docs (no clientId). All rows
// collapsed onto the key `undefined` and the picker showed one category.
test("old-shape server rows never collapse the category list", () => {
  const oldShape = [
    { _id: "jx78kxwh", _creationTime: 1, userId: "u", name: "شطرنج", isPublic: true },
    { _id: "jx70h71v", _creationTime: 2, userId: "u", name: "کد نویسی", isPublic: true },
    { _id: "jx74fgq2", _creationTime: 3, userId: "u", name: "یادگیری", isPublic: true },
    { _id: "jx78h468", _creationTime: 4, userId: "u", name: "هانت", isPublic: true },
  ];
  const normalized = normalizeServerCategories(oldShape);
  assert.equal(normalized.length, 4);
  const visible = effectiveCategories({ ...EMPTY_STATE, serverCategories: normalized });
  assert.deepEqual(
    visible.map((c) => c.name).sort(),
    ["شطرنج", "هانت", "کد نویسی", "یادگیری"].sort(),
  );
});

test("a bad cache persisted by an old build is normalized on read too", () => {
  // effectiveCategories must survive state.serverCategories containing
  // un-normalized rows (written before normalizeServerCategories existed).
  const staleCache = [
    { _id: "a", name: "یک", isPublic: true },
    { _id: "b", name: "دو", isPublic: false },
  ] as never;
  const visible = effectiveCategories({ ...EMPTY_STATE, serverCategories: staleCache });
  assert.equal(visible.length, 2);
});

test("garbage rows are dropped, valid ones kept", () => {
  const rows = [
    null,
    42,
    { name: "بی‌کلید" }, // no clientId or _id
    { clientId: "ok", name: "درسته", isPublic: true, updatedAt: 5 },
  ];
  const normalized = normalizeServerCategories(rows);
  assert.deepEqual(normalized, [
    { clientId: "ok", name: "درسته", isPublic: true, updatedAt: 5 },
  ]);
});

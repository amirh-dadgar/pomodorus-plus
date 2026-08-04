// The drain loop (`lib/sync-drain`), driven with a push the test resolves by
// hand. Rendered with real React against a real store, so what these assert is
// the actual interleaving of effects, refs and storage — which is the whole
// point, since every bug this loop has had was a timing bug.
//
// After ADR 0006 nothing here can delete a device's work; what it can still do
// is stall, and a queue nobody retries is a queue that never arrives.

import "./dom";
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook } from "@testing-library/react";
import { RETRY_MS, useSyncDrain, type Ack, type Push } from "../lib/sync-drain";
import { getState, setIdentity } from "../lib/local/store";
import { EMPTY_STATE, MINUTE_MS, type LocalState } from "../lib/local/types";

const WORK_MS = 25 * MINUTE_MS;

const pending = (clientId: string) => ({
  clientId,
  startedAt: 1_000_000,
  durationMs: WORK_MS,
  endedAt: 1_000_000 + WORK_MS,
});

/**
 * Put `state` in the store under a username nobody else in this file uses.
 *
 * Switching identity is what makes the store reload rather than serve its
 * cache, so each test gets a queue of its own without reaching past the
 * module's public API.
 */
let accounts = 0;
function seed(over: Partial<LocalState>) {
  const username = `user${++accounts}`;
  window.localStorage.setItem(
    `pomodorus:v1:${username}`,
    JSON.stringify({ ...EMPTY_STATE, ...over }),
  );
  setIdentity(username);
}

/** A promise the test decides the fate of. */
function deferred<T>() {
  let settle!: (value: T) => void;
  let fail!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    settle = res;
    fail = rej;
  });
  return { promise, settle, fail };
}

const ackAll = (sessions: string[], categoryOps: string[] = []): Ack => ({
  sessions,
  categoryOps,
});

/** Let queued microtasks (and the effects they schedule) run. */
const flush = () => act(async () => {});

const drain = (push: Push, isAuthenticated = true) =>
  renderHook(() => useSyncDrain({ isAuthenticated, push }));

test.afterEach(() => {
  cleanup();
  mock.timers.reset();
});

// ---- Pushing at all ----

test("a queued session is pushed and cleared once acknowledged", async () => {
  seed({ pendingSessions: [pending("s1")] });
  const calls: string[][] = [];
  const push: Push = async ({ sessions }) => {
    calls.push(sessions.map((s) => s.clientId));
    return ackAll(sessions.map((s) => s.clientId));
  };

  drain(push);
  await flush();

  assert.deepEqual(calls, [["s1"]]);
  assert.deepEqual(getState().pendingSessions, []);
});

// The rule from ADR 0006, end to end through the real store: the device
// forgets what the server named, and keeps the rest.
test("an unacknowledged session stays queued and is pushed again", async () => {
  seed({ pendingSessions: [pending("stored"), pending("deferred")] });
  const calls: string[][] = [];
  const push: Push = async ({ sessions }) => {
    calls.push(sessions.map((s) => s.clientId));
    // Only ever acknowledge the first one.
    return ackAll(sessions.filter((s) => s.clientId === "stored").map((s) => s.clientId));
  };

  drain(push);
  await flush();

  assert.deepEqual(
    getState().pendingSessions.map((s) => s.clientId),
    ["deferred"],
    "the unacknowledged session is still on the queue",
  );
  // The queue shrank, so the loop woke itself and offered the remainder again.
  assert.deepEqual(calls, [
    ["stored", "deferred"],
    ["deferred"],
  ]);
});

test("nothing is pushed while signed out", async () => {
  seed({ pendingSessions: [pending("s1")] });
  let pushes = 0;
  const push: Push = async ({ sessions }) => {
    pushes++;
    return ackAll(sessions.map((s) => s.clientId));
  };

  drain(push, false);
  await flush();

  assert.equal(pushes, 0);
  assert.equal(getState().pendingSessions.length, 1, "the work is held, not lost");
});

test("an empty queue is not pushed", async () => {
  seed({});
  let pushes = 0;
  const push: Push = async () => {
    pushes++;
    return ackAll([]);
  };

  drain(push);
  await flush();

  assert.equal(pushes, 0);
});

// ---- One at a time, and nothing forgotten ----

test("only one push is in flight at a time", async () => {
  seed({ pendingSessions: [pending("s1")] });
  const gate = deferred<Ack>();
  let inFlight = 0;
  let concurrent = 0;
  const push: Push = () => {
    inFlight++;
    concurrent = Math.max(concurrent, inFlight);
    return gate.promise.finally(() => {
      inFlight--;
    });
  };

  const { rerender } = drain(push);
  await flush();
  // Re-render repeatedly while the push hangs.
  for (let i = 0; i < 3; i++) rerender();
  await flush();

  assert.equal(concurrent, 1);
  await act(async () => {
    gate.settle(ackAll(["s1"]));
  });
});

// The stall this loop was built wrong for: work that arrives mid-flight used
// to be dropped, and the loop then sat idle until something unrelated moved.
test("a session queued during a push gets its own push afterwards", async () => {
  seed({ pendingSessions: [pending("s1")] });
  const gate = deferred<Ack>();
  const calls: string[][] = [];
  const push: Push = ({ sessions }) => {
    calls.push(sessions.map((s) => s.clientId));
    // The first push hangs; every later one resolves at once.
    return calls.length === 1
      ? gate.promise
      : Promise.resolve(ackAll(sessions.map((s) => s.clientId)));
  };

  drain(push);
  await flush();
  assert.deepEqual(calls, [["s1"]], "the first push is in flight");

  // A pomodoro finishes while that push is still out. The store is the only
  // thing that changes — exactly as it would in the app.
  const state = getState();
  window.localStorage.setItem(
    `pomodorus:v1:user${accounts}`,
    JSON.stringify({ ...state, pendingSessions: [...state.pendingSessions, pending("s2")] }),
  );
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: `pomodorus:v1:user${accounts}` }),
    );
  });

  await act(async () => {
    gate.settle(ackAll(["s1"]));
  });
  await flush();

  assert.deepEqual(calls[1], ["s2"], "the session that arrived mid-flight was pushed");
  assert.deepEqual(getState().pendingSessions, [], "and nothing was left behind");
});

// ---- Waking back up ----

test("a failed push is retried after a pause", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  seed({ pendingSessions: [pending("s1")] });
  const calls: string[][] = [];
  const push: Push = ({ sessions }) => {
    calls.push(sessions.map((s) => s.clientId));
    return calls.length === 1
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(ackAll(sessions.map((s) => s.clientId)));
  };

  drain(push);
  await flush();
  assert.equal(calls.length, 1, "failed, and nothing has changed to wake it");

  await act(async () => {
    mock.timers.tick(RETRY_MS);
  });
  await flush();

  assert.equal(calls.length, 2, "the timer brought it back");
  assert.deepEqual(getState().pendingSessions, []);
});

// An ack naming nothing changes no state, so nothing would re-run the effect.
test("a wholly unacknowledged push is retried after a pause", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  seed({ pendingSessions: [pending("skewed")] });
  const calls: string[][] = [];
  const push: Push = ({ sessions }) => {
    calls.push(sessions.map((s) => s.clientId));
    return Promise.resolve(ackAll([])); // the server cannot store it yet
  };

  drain(push);
  await flush();
  assert.equal(calls.length, 1);

  await act(async () => {
    mock.timers.tick(RETRY_MS);
  });
  await flush();

  assert.equal(calls.length, 2, "it keeps offering the session");
  assert.equal(getState().pendingSessions.length, 1, "and still has it to offer");
});

test("an unmounted engine leaves no retry armed", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  seed({ pendingSessions: [pending("s1")] });
  let pushes = 0;
  const push: Push = () => {
    pushes++;
    return Promise.reject(new Error("offline"));
  };

  const { unmount } = drain(push);
  await flush();
  assert.equal(pushes, 1);

  unmount();
  await act(async () => {
    mock.timers.tick(RETRY_MS * 3);
  });

  assert.equal(pushes, 1, "no push fires after unmount");
});

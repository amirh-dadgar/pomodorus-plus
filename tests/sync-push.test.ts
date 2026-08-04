// The database half of `sync.push` (docs/adr/0006-acknowledged-sync.md): what
// actually lands in the log, and — the part the protocol turns on — exactly
// which items come back acknowledged.
//
// `lib/sync-rules` covers the verdict on a single session in isolation. What
// is exercised here is everything that needs a database to be true at all:
// dedupe across retries, last-write-wins on categories, tombstones, the batch
// cap, and the fact that one user's queue cannot touch another's.

import test from "node:test";
import assert from "node:assert/strict";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { MINUTE_MS } from "../lib/local/types";

// convex-test discovers function modules from this map; it locates the root by
// finding the `_generated` entry, so that one is required even though nothing
// calls into it.
const modules = {
  "../convex/_generated/api.js": () => import("../convex/_generated/api.js"),
  "../convex/sync.ts": () => import("../convex/sync"),
};

const WORK_MS = 25 * MINUTE_MS;

/** A test backend with one signed-in user, and a handle to push as them. */
async function withUser(username = "yazdan") {
  const t = convexTest(schema, modules);
  const userId = await t.run(async (ctx) => ctx.db.insert("users", { username }));
  // `getAuthUserId` reads the user id off the subject, ahead of the "|".
  return { t, userId, as: t.withIdentity({ subject: `${userId}|session1` }) };
}

/** A session the timer could really have produced, ending `agoMs` ago. */
const session = (
  clientId: string,
  over: Partial<{
    startedAt: number;
    durationMs: number;
    endedAt: number;
    categoryClientId: string;
    devFast: boolean;
  }> = {},
) => {
  const startedAt = Date.now() - 60 * MINUTE_MS;
  return {
    clientId,
    startedAt,
    durationMs: WORK_MS,
    endedAt: startedAt + WORK_MS,
    ...over,
  };
};

const logged = (t: ReturnType<typeof convexTest>) =>
  t.run(async (ctx) => ctx.db.query("sessions").collect());

// ---- Sessions ----

test("a valid session is logged once and acknowledged", async () => {
  const { t, as } = await withUser();
  const ack = await as.mutation(api.sync.push, {
    sessions: [session("s1")],
    categoryOps: [],
  });

  assert.deepEqual(ack.sessions, ["s1"]);
  const rows = await logged(t);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].clientId, "s1");
  assert.equal(rows[0].status, "completed");
  assert.equal(rows[0].kind, "work");
  assert.equal(rows[0].durationMs, WORK_MS);
});

// The property every retry depends on: a device that pushed successfully but
// lost the response pushes again, and must not be credited twice.
test("re-pushing a session credits it once and acknowledges it again", async () => {
  const { t, as } = await withUser();
  const s = session("s1");
  const first = await as.mutation(api.sync.push, { sessions: [s], categoryOps: [] });
  const second = await as.mutation(api.sync.push, { sessions: [s], categoryOps: [] });

  assert.deepEqual(first.sessions, ["s1"]);
  // Acked the second time too, or the device would carry it forever.
  assert.deepEqual(second.sessions, ["s1"]);
  assert.equal((await logged(t)).length, 1);
});

// The bug this whole protocol exists to prevent. Before the ack, the device
// cleared everything it sent, so this session was erased rather than retried.
test("a future-dated session is neither logged nor acknowledged", async () => {
  const { t, as } = await withUser();
  const startedAt = Date.now() + 30 * MINUTE_MS; // clock half an hour fast
  const ack = await as.mutation(api.sync.push, {
    sessions: [session("skewed", { startedAt, endedAt: startedAt + WORK_MS })],
    categoryOps: [],
  });

  assert.deepEqual(ack.sessions, [], "must not be acknowledged");
  assert.equal((await logged(t)).length, 0, "must not be credited yet");
});

test("an unstorable session is acknowledged but never logged", async () => {
  const { t, as } = await withUser();
  const startedAt = Date.now() - 12 * 60 * MINUTE_MS;
  const tenHours = 10 * 60 * MINUTE_MS;
  const ack = await as.mutation(api.sync.push, {
    sessions: [session("forged", { startedAt, durationMs: tenHours, endedAt: startedAt + tenHours })],
    categoryOps: [],
  });

  // Acked so the device stops carrying it; not logged, so it earns nothing.
  assert.deepEqual(ack.sessions, ["forged"]);
  assert.equal((await logged(t)).length, 0);
});

test("a good session in a batch is logged even when its neighbours are not", async () => {
  const { t, as } = await withUser();
  const future = Date.now() + 30 * MINUTE_MS;
  const ack = await as.mutation(api.sync.push, {
    sessions: [
      session("forged", { durationMs: 7 * MINUTE_MS, endedAt: Date.now() - 53 * MINUTE_MS }),
      session("good"),
      session("skewed", { startedAt: future, endedAt: future + WORK_MS }),
    ],
    categoryOps: [],
  });

  assert.deepEqual(ack.sessions.sort(), ["forged", "good"]);
  const rows = await logged(t);
  assert.deepEqual(
    rows.map((r) => r.clientId),
    ["good"],
  );
});

test("a session is attached to its own category", async () => {
  const { t, as } = await withUser();
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "upsert", name: "کد نویسی", isPublic: true, at: 1 }],
  });
  await as.mutation(api.sync.push, {
    sessions: [session("s1", { categoryClientId: "c1" })],
    categoryOps: [],
  });

  const rows = await logged(t);
  const category = await t.run(async (ctx) =>
    ctx.db.get(rows[0].categoryId as Id<"categories">),
  );
  assert.equal(category?.name, "کد نویسی");
});

// ---- The batch cap: the second way sessions used to vanish ----

test("a backlog past the cap is acknowledged in batches, losing nothing", async () => {
  const { t, as } = await withUser();
  const startedAt = Date.now() - 60 * MINUTE_MS;
  const backlog = Array.from({ length: 620 }, (_, i) => ({
    clientId: `s${i}`,
    startedAt,
    durationMs: WORK_MS,
    endedAt: startedAt + WORK_MS,
  }));

  const first = await as.mutation(api.sync.push, { sessions: backlog, categoryOps: [] });
  assert.equal(first.sessions.length, 500, "one push drains one batch");

  // The device clears the acked 500 and pushes what is left, as the engine does.
  const remaining = backlog.filter((s) => !new Set(first.sessions).has(s.clientId));
  assert.equal(remaining.length, 120);
  const second = await as.mutation(api.sync.push, { sessions: remaining, categoryOps: [] });
  assert.equal(second.sessions.length, 120);

  assert.equal((await logged(t)).length, 620, "every session survived");
});

// ---- Categories ----

test("a later edit wins and an older one is acknowledged without applying", async () => {
  const { t, as } = await withUser();
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "upsert", name: "جدید", isPublic: true, at: 200 }],
  });
  // A stale op from another device, queued before the edit above.
  const ack = await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "upsert", name: "قدیمی", isPublic: true, at: 100 }],
  });

  assert.deepEqual(ack.categoryOps, ["c1:100"], "settled, so the device drops it");
  const rows = await t.run(async (ctx) => ctx.db.query("categories").collect());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "جدید", "the newer edit stands");
});

test("a delete tombstones the category and a later upsert cannot revive it", async () => {
  const { t, as } = await withUser();
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "upsert", name: "شطرنج", isPublic: true, at: 100 }],
  });
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "delete", at: 200 }],
  });
  // A rename queued on another device before it heard about the delete.
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "c1", op: "upsert", name: "دوباره", isPublic: true, at: 300 }],
  });

  const rows = await t.run(async (ctx) => ctx.db.query("categories").collect());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deleted, true, "delete beats a later rename");
  assert.equal(rows[0].name, "شطرنج", "the name is kept so history still reads");
});

test("deleting a category the server never saw still tombstones it", async () => {
  const { t, as } = await withUser();
  await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [{ clientId: "ghost", op: "delete", at: 100 }],
  });

  const rows = await t.run(async (ctx) => ctx.db.query("categories").collect());
  assert.equal(rows.length, 1);
  assert.equal(rows[0].deleted, true);
});

test("a refused name is acknowledged and creates nothing", async () => {
  const { t, as } = await withUser();
  const ack = await as.mutation(api.sync.push, {
    sessions: [],
    categoryOps: [
      { clientId: "empty", op: "upsert", name: "   ", isPublic: true, at: 100 },
      { clientId: "long", op: "upsert", name: "ب".repeat(41), isPublic: true, at: 100 },
    ],
  });

  // Settled: the device that meant it already refused it in its own words.
  assert.deepEqual(ack.categoryOps.sort(), ["empty:100", "long:100"]);
  assert.equal((await t.run(async (ctx) => ctx.db.query("categories").collect())).length, 0);
});

// ---- Isolation ----

test("one user's queue cannot reach another user's log", async () => {
  const a = await withUser("yazdan");
  // Same backend, a second user, and a colliding clientId.
  const userB = await a.t.run(async (ctx) => ctx.db.insert("users", { username: "sara" }));
  const asB = a.t.withIdentity({ subject: `${userB}|session1` });

  await a.as.mutation(api.sync.push, { sessions: [session("shared")], categoryOps: [] });
  const ackB = await asB.mutation(api.sync.push, {
    sessions: [session("shared")],
    categoryOps: [],
  });

  // B's session is not deduped away by A's row of the same clientId.
  assert.deepEqual(ackB.sessions, ["shared"]);
  const rows = await logged(a.t);
  assert.equal(rows.length, 2, "each user is credited their own session");
  assert.equal(new Set(rows.map((r) => r.userId)).size, 2);
});

test("an unauthenticated push is refused outright", async () => {
  const t = convexTest(schema, modules);
  await assert.rejects(
    () => t.mutation(api.sync.push, { sessions: [session("s1")], categoryOps: [] }),
    /.*/,
  );
  assert.equal((await logged(t)).length, 0);
});

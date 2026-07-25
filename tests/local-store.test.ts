import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveCategories,
  normalizeServerCategories,
  settled,
} from "../lib/local/store";
import { EMPTY_STATE, MINUTE_MS } from "../lib/local/types";

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

test("retroactive settle chain: work completes, break auto-runs, cycle counts", () => {
  const t0 = 1_000_000_000_000;
  const s = {
    ...EMPTY_STATE,
    running: {
      id: "w1",
      kind: "work" as const,
      categoryClientId: "cat1",
      startedAt: t0,
      durationMs: 25 * MINUTE_MS,
    },
  };
  assert.equal(settled(s, t0 + 10 * MINUTE_MS), s); // mid-session: untouched

  const after = settled(s, t0 + 60 * MINUTE_MS); // whole chain elapsed
  assert.equal(after.running, null);
  assert.equal(after.cycleCount, 1);
  assert.equal(after.pendingSessions.length, 1);
  assert.equal(after.pendingSessions[0].endedAt, t0 + 25 * MINUTE_MS);
  assert.equal(after.lastEnded?.kind, "shortBreak");
});

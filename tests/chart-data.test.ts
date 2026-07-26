import test from "node:test";
import assert from "node:assert/strict";
import { buildChartDays } from "../convex/chartData";
import { lastDayKeys, tehranDayKey } from "../convex/days";

// Noon UTC is unambiguously inside the same-named Tehran day (UTC+3:30).
const noon = (dayKey: string) => Date.parse(`${dayKey}T12:00:00Z`);

const HOUR = 3_600_000;

test("days are zero-filled over the whole range, oldest first", () => {
  const dayKeys = ["2026-07-20", "2026-07-21", "2026-07-22"];
  const out = buildChartDays({
    dayKeys,
    sessions: [{ endMs: noon("2026-07-21"), durationMs: HOUR }],
    categories: new Map(),
    isOwner: false,
  });
  assert.deepEqual(
    out.map((d) => [d.dayKey, d.totalMs]),
    [
      ["2026-07-20", 0],
      ["2026-07-21", HOUR],
      ["2026-07-22", 0],
    ],
  );
});

test("sessions outside the range are dropped", () => {
  const out = buildChartDays({
    dayKeys: ["2026-07-21"],
    sessions: [
      { endMs: noon("2026-07-19"), durationMs: HOUR },
      { endMs: noon("2026-07-22"), durationMs: HOUR },
    ],
    categories: new Map(),
    isOwner: false,
  });
  assert.equal(out[0].totalMs, 0);
});

test("a session lands on the Tehran day of its end time", () => {
  // 21:30 UTC on the 20th is already 01:00 on the 21st in Tehran.
  const lateUtc = Date.parse("2026-07-20T21:30:00Z");
  assert.equal(tehranDayKey(lateUtc), "2026-07-21");
  const out = buildChartDays({
    dayKeys: ["2026-07-20", "2026-07-21"],
    sessions: [{ endMs: lateUtc, durationMs: HOUR }],
    categories: new Map(),
    isOwner: false,
  });
  assert.deepEqual(
    out.map((d) => d.totalMs),
    [0, HOUR],
  );
});

test("visitors get private categories collapsed into one masked bucket", () => {
  const categories = new Map([
    ["a", { name: "درس", isPublic: true }],
    ["b", { name: "راز", isPublic: false }],
    ["c", { name: "راز دوم", isPublic: false }],
  ]);
  const sessions = [
    { categoryId: "a", endMs: noon("2026-07-21"), durationMs: 2 * HOUR },
    { categoryId: "b", endMs: noon("2026-07-21"), durationMs: HOUR },
    { categoryId: "c", endMs: noon("2026-07-21"), durationMs: HOUR },
  ];
  const [day] = buildChartDays({ dayKeys: ["2026-07-21"], sessions, categories, isOwner: false });
  assert.deepEqual(day.slices, [
    { name: "درس", ms: 2 * HOUR },
    { bucket: "private", ms: 2 * HOUR },
  ]);
});

test("the owner sees every private category by name", () => {
  const categories = new Map([
    ["b", { name: "راز", isPublic: false }],
    ["c", { name: "راز دوم", isPublic: false }],
  ]);
  const sessions = [
    { categoryId: "b", endMs: noon("2026-07-21"), durationMs: 2 * HOUR },
    { categoryId: "c", endMs: noon("2026-07-21"), durationMs: HOUR },
  ];
  const [day] = buildChartDays({ dayKeys: ["2026-07-21"], sessions, categories, isOwner: true });
  assert.deepEqual(day.slices, [
    { name: "راز", ms: 2 * HOUR },
    { name: "راز دوم", ms: HOUR },
  ]);
});

test("no category, unknown category, and empty-name tombstones share the none bucket", () => {
  const categories = new Map([["tomb", { name: "", isPublic: false }]]);
  const sessions = [
    { endMs: noon("2026-07-21"), durationMs: HOUR },
    { categoryId: "gone", endMs: noon("2026-07-21"), durationMs: HOUR },
    { categoryId: "tomb", endMs: noon("2026-07-21"), durationMs: HOUR },
  ];
  const [day] = buildChartDays({ dayKeys: ["2026-07-21"], sessions, categories, isOwner: true });
  assert.deepEqual(day.slices, [{ bucket: "none", ms: 3 * HOUR }]);
});

test("duplicate category names merge into one row, sorted largest first", () => {
  const categories = new Map([
    ["a1", { name: "کار", isPublic: true }],
    ["a2", { name: "کار", isPublic: true }],
    ["b", { name: "درس", isPublic: true }],
  ]);
  const sessions = [
    { categoryId: "a1", endMs: noon("2026-07-21"), durationMs: HOUR },
    { categoryId: "a2", endMs: noon("2026-07-21"), durationMs: HOUR },
    { categoryId: "b", endMs: noon("2026-07-21"), durationMs: 3 * HOUR },
  ];
  const [day] = buildChartDays({ dayKeys: ["2026-07-21"], sessions, categories, isOwner: false });
  assert.deepEqual(day.slices, [
    { name: "درس", ms: 3 * HOUR },
    { name: "کار", ms: 2 * HOUR },
  ]);
});

test("lastDayKeys ends at the Tehran day containing now", () => {
  const now = noon("2026-07-26");
  assert.deepEqual(lastDayKeys(3, now), ["2026-07-24", "2026-07-25", "2026-07-26"]);
});

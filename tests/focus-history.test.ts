import test from "node:test";
import assert from "node:assert/strict";
import { focusHistory, type ChartPayload, type FocusDay } from "../lib/focus-history";

const HOUR = 3_600_000;

const day = (dayKey: string, totalMs: number): FocusDay => ({
  dayKey,
  totalMs,
  slices: totalMs > 0 ? [{ name: "کد نویسی", ms: totalMs }] : [],
});

const payload = (days: FocusDay[], isOwner = false): ChartPayload => ({
  username: "yazdan",
  isOwner,
  days,
});

const WEEK = [
  day("2026-07-24", 0),
  day("2026-07-25", 2 * HOUR),
  day("2026-07-26", 0),
  day("2026-07-27", HOUR),
  day("2026-07-28", 0),
];

test("nothing loaded yet is a whole-page load", () => {
  const view = focusHistory({ live: undefined, cached: undefined, hovered: null });
  assert.equal(view.state, "loading");
});

test("no such user", () => {
  const view = focusHistory({ live: null, cached: undefined, hovered: null });
  assert.equal(view.state, "notFound");
});

test("a range switch keeps the shell and reloads the chart area", () => {
  // The new range's query is in flight; the previous payload is all we have.
  const view = focusHistory({
    live: undefined,
    cached: payload(WEEK, true),
    hovered: null,
  });
  assert.equal(view.state, "reloading");
  assert.equal(view.state === "reloading" && view.username, "yazdan");
  assert.equal(view.state === "reloading" && view.isOwner, true);
});

test("a cached payload never outranks a live one", () => {
  const view = focusHistory({
    live: payload([day("2026-07-28", HOUR)]),
    cached: payload(WEEK),
    hovered: null,
  });
  assert.equal(view.state, "ready");
  assert.deepEqual(
    view.state === "ready" ? view.days.map((d) => d.dayKey) : [],
    ["2026-07-28"],
  );
});

test("a range with no focus time at all is empty, not ready", () => {
  const view = focusHistory({
    live: payload([day("2026-07-27", 0), day("2026-07-28", 0)]),
    cached: undefined,
    hovered: null,
  });
  assert.equal(view.state, "empty");
});

test("with nothing pointed at, the panel rests on the last day with data", () => {
  const view = focusHistory({ live: payload(WEEK), cached: undefined, hovered: null });
  assert.equal(view.state, "ready");
  if (view.state !== "ready") return;
  // Not 2026-07-28 — that day is zero-filled.
  assert.equal(view.selectedKey, "2026-07-27");
  assert.equal(view.selected?.totalMs, HOUR);
});

test("pointing inside the range wins over the default", () => {
  const view = focusHistory({
    live: payload(WEEK),
    cached: undefined,
    hovered: "2026-07-25",
  });
  assert.equal(view.state === "ready" && view.selectedKey, "2026-07-25");
  assert.equal(view.state === "ready" && view.selected?.totalMs, 2 * HOUR);
});

test("a day left over from a wider range is ignored, not shown blank", () => {
  // Regression shape: point at day 60 of the 90-day range, then switch to 7.
  const view = focusHistory({
    live: payload(WEEK),
    cached: undefined,
    hovered: "2026-05-30",
  });
  assert.equal(view.state === "ready" && view.selectedKey, "2026-07-27");
});

test("a pointed-at empty day marks the chart but renders no day detail", () => {
  const view = focusHistory({
    live: payload(WEEK),
    cached: undefined,
    hovered: "2026-07-26",
  });
  assert.equal(view.state, "ready");
  if (view.state !== "ready") return;
  // The crosshair still needs somewhere to sit...
  assert.equal(view.selectedKey, "2026-07-26");
  // ...but a zero day gets no panel rather than ۰:۰۰ over an empty list.
  assert.equal(view.selected, undefined);
});

test("the owner flag survives to the ready state", () => {
  const view = focusHistory({
    live: payload(WEEK, true),
    cached: undefined,
    hovered: null,
  });
  assert.equal(view.state === "ready" && view.isOwner, true);
});

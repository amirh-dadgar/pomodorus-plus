import test from "node:test";
import assert from "node:assert/strict";
import { faHourClock } from "../lib/format";

test("hours and minutes split at the hour", () => {
  assert.equal(faHourClock(2 * 3_600_000 + 25 * 60_000), "۲:۲۵");
  assert.equal(faHourClock(3_600_000), "۱:۰۰");
});

test("under an hour still reads as a clock, zero-padded", () => {
  assert.equal(faHourClock(45 * 60_000), "۰:۴۵");
  assert.equal(faHourClock(5 * 60_000), "۰:۰۵");
});

test("an empty day is ۰:۰۰ rather than blank", () => {
  assert.equal(faHourClock(0), "۰:۰۰");
});

test("seconds round to the nearest minute, matching faDuration", () => {
  assert.equal(faHourClock(59_000), "۰:۰۱");
  assert.equal(faHourClock(29_000), "۰:۰۰");
  // 59m30s rounds up to a full hour rather than showing ۰:۶۰.
  assert.equal(faHourClock(59 * 60_000 + 30_000), "۱:۰۰");
});

test("past ten hours the clock just gets wider", () => {
  assert.equal(faHourClock(12 * 3_600_000 + 5 * 60_000), "۱۲:۰۵");
});

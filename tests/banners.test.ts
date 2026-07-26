import test from "node:test";
import assert from "node:assert/strict";
import { pickBanner } from "../lib/banners";

const BANNERS = ["/banners/a.avif", "/banners/b.avif", "/banners/c.avif"];

test("never repeats the previous banner", () => {
  for (const last of BANNERS) {
    // Sweep the whole random range: no draw may land back on `last`.
    for (const r of [0, 0.34, 0.5, 0.67, 0.999]) {
      assert.notEqual(pickBanner(BANNERS, last, () => r), last);
    }
  }
});

test("every other banner stays reachable", () => {
  const seen = new Set(
    [0, 0.5, 0.999].map((r) => pickBanner(BANNERS, "/banners/a.avif", () => r)),
  );
  assert.deepEqual([...seen].sort(), ["/banners/b.avif", "/banners/c.avif"]);
});

test("an unknown or absent last banner leaves the full list in play", () => {
  const seen = new Set([0, 0.4, 0.7].map((r) => pickBanner(BANNERS, null, () => r)));
  assert.deepEqual([...seen].sort(), BANNERS);
});

test("a lone banner repeats rather than vanishing", () => {
  assert.equal(pickBanner(["/banners/a.avif"], "/banners/a.avif"), "/banners/a.avif");
});

test("no banners means no banner", () => {
  assert.equal(pickBanner([], null), null);
});

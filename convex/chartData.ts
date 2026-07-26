import { tehranDayKey } from "./days";

// A day-detail row. Exactly one of `name`/`bucket` is set: `name` is a real
// category label; `bucket` is "private" (a visitor's view of all private
// categories combined) or "none" (sessions without a category, plus
// empty-name tombstones that have no label to show).
export type ChartSlice = { name?: string; bucket?: "private" | "none"; ms: number };

export type ChartDay = { dayKey: string; totalMs: number; slices: ChartSlice[] };

type SessionLike = { categoryId?: string; endMs: number; durationMs: number };
type CategoryLike = { name: string; isPublic: boolean };

/**
 * Bucket completed work sessions into per-day, per-category slices for the
 * profile's focus chart. Days are zero-filled over `dayKeys` (oldest first);
 * slices are sorted largest first. For visitors, private categories collapse
 * into one "private" bucket; owners see every name. Deleted categories keep
 * appearing under their preserved name — history is never erased.
 */
export function buildChartDays(opts: {
  dayKeys: string[];
  sessions: SessionLike[];
  categories: Map<string, CategoryLike>;
  isOwner: boolean;
}): ChartDay[] {
  const { dayKeys, sessions, categories, isOwner } = opts;
  const byDay = new Map<string, Map<string, ChartSlice>>();
  for (const key of dayKeys) byDay.set(key, new Map());

  for (const s of sessions) {
    const day = byDay.get(tehranDayKey(s.endMs));
    if (!day) continue; // outside the selected range

    const category = s.categoryId ? categories.get(s.categoryId) : undefined;
    let slice: ChartSlice;
    if (!category || category.name === "") slice = { bucket: "none", ms: 0 };
    else if (!isOwner && !category.isPublic) slice = { bucket: "private", ms: 0 };
    else slice = { name: category.name, ms: 0 };

    // Duplicate category names merge into one row — the display label is the
    // identity here, matching how the owner thinks about their tasks.
    const key = slice.name !== undefined ? `n:${slice.name}` : slice.bucket!;
    const existing = day.get(key);
    if (existing) existing.ms += s.durationMs;
    else day.set(key, { ...slice, ms: s.durationMs });
  }

  return dayKeys.map((dayKey) => {
    const slices = [...byDay.get(dayKey)!.values()].sort((a, b) => b.ms - a.ms);
    return {
      dayKey,
      totalMs: slices.reduce((sum, s) => sum + s.ms, 0),
      slices,
    };
  });
}

// Client-safe chart builder for the local-first (offline / anonymous) profile.
// Mirrors convex/chartData.ts but reads from LocalState instead of the server,
// so an anonymous device can see its own focus chart and day detail with no
// network and no login. Pure functions only — safe to import in any component.

import { type LocalState, type PendingSession } from "@/lib/local/types";
import { effectiveCategories } from "@/lib/local/device";
import { type FocusHistory } from "@/lib/focus-history";

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const TEHRAN_OFFSET_MS = 3.5 * 60 * MINUTE_MS;

/** "YYYY-MM-DD" key of the Tehran-local day containing `ts`. */
export function tehranDayKey(ts: number): string {
  return new Date(ts + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}

/** The last `count` Tehran day keys ending at the day containing `now`, oldest first. */
export function lastDayKeys(count: number, now: number): string[] {
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) keys.push(tehranDayKey(now - i * DAY_MS));
  return keys;
}

export type ChartSlice = {
  name?: string;
  bucket?: "private" | "none";
  ms: number;
};

export type ChartDay = {
  dayKey: string;
  totalMs: number;
  slices: ChartSlice[];
};

/** Resolve a category's display label from local state (pending + server). */
function categoryName(state: LocalState, clientId: string | null | undefined): string {
  if (!clientId) return ""; // private stand-in; buildChartDays buckets it
  // Use effectiveCategories (server mirror + local edits), the same source the
  // timer's CategoryPicker reads — so an offline-created category resolves here
  // exactly as it does in the timer, instead of only when it has synced.
  const cat = effectiveCategories(state).find((c) => c.clientId === clientId);
  return cat?.name ?? "";
}

/**
 * Bucket the local pending sessions into per-day, per-category slices for the
 * focus chart. Mirrors convex/chartData.buildChartDays but for one device's
 * LocalState. Days are zero-filled over `dayKeys` (oldest first); slices
 * sorted largest first.
 */
export function buildLocalChartDays(opts: {
  dayKeys: string[];
  state: LocalState;
  now: number;
}): ChartDay[] {
  const { dayKeys, state } = opts;
  const byDay = new Map<string, Map<string, ChartSlice>>();
  for (const key of dayKeys) byDay.set(key, new Map());

  const sessions: PendingSession[] = state.pendingSessions;
  for (const s of sessions) {
    const day = byDay.get(tehranDayKey(s.endedAt));
    if (!day) continue; // outside the selected range

    const name = categoryName(state, s.categoryClientId);
    const slice: ChartSlice =
      name === "" ? { bucket: "none", ms: 0 } : { name, ms: 0 };

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

/**
 * The offline equivalent of `focusHistory` for the local profile: builds the
 * chart from LocalState (anonymous or signed-in) and returns the same
 * `FocusHistory` shape the server-backed profile renders, so the component
 * needs no branch in its JSX — only in where it sources `view` from.
 */
export function localFocusHistory(opts: {
  state: LocalState;
  range: number;
  now: number;
  hovered: string | null;
}): FocusHistory {
  const { state, range, now, hovered } = opts;
  const dayKeys = lastDayKeys(range, now);
  const days = buildLocalChartDays({ dayKeys, state, now });

  const lastWithData = [...days].reverse().find((d) => d.totalMs > 0);
  if (lastWithData === undefined) {
    return { state: "empty", username: "مهمان", isOwner: true };
  }

  const selectedKey =
    hovered !== null && days.some((d) => d.dayKey === hovered)
      ? hovered
      : lastWithData.dayKey;
  const pointed = days.find((d) => d.dayKey === selectedKey);
  const selected = pointed !== undefined && pointed.totalMs > 0 ? pointed : undefined;

  return {
    state: "ready",
    username: "مهمان",
    isOwner: true,
    days,
    selectedKey,
    selected,
  };
}

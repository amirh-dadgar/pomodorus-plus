// The profile's focus history: the Focus chart's days for the selected Range,
// plus which Day detail is showing. Everything the profile page renders is one
// value from here — loading, missing user, empty range, and the pointed-at day
// are all the same decision, made once.

import type { ChartDay, ChartSlice } from "@/convex/chartData";

export type FocusSlice = ChartSlice;
export type FocusDay = ChartDay;

/** What `api.profiles.chart` resolves to: the profile, or null for no such user. */
export type ChartPayload = {
  username: string;
  isOwner: boolean;
  days: FocusDay[];
} | null;

export type FocusHistory =
  /** Nothing to show yet: the first load of this profile. */
  | { state: "loading" }
  | { state: "notFound" }
  /** A Range switch is in flight; the shell renders from the previous payload. */
  | { state: "reloading"; username: string; isOwner: boolean }
  /** Loaded, but no day in the Range has any focus time. */
  | { state: "empty"; username: string; isOwner: boolean }
  | {
      state: "ready";
      username: string;
      isOwner: boolean;
      days: FocusDay[];
      /** The day the chart marks. Always a day in `days`. */
      selectedKey: string;
      /** The Day detail to render, or undefined when the marked day is empty. */
      selected: FocusDay | undefined;
    };

/**
 * Decide what the profile shows, from the live query result, the last payload
 * it returned, and the day being pointed at.
 *
 * `live` is undefined while a query is in flight. Switching Range resubscribes,
 * so it goes undefined again mid-visit — `cached` is what keeps the page shell
 * from unmounting into a full skeleton every time.
 */
export function focusHistory(opts: {
  live: ChartPayload | undefined;
  cached: ChartPayload | undefined;
  hovered: string | null;
}): FocusHistory {
  const { live, cached, hovered } = opts;

  // Not `live ?? cached`: a resolved null means "no such user" and must not
  // fall through to the previous payload — nor be mistaken for still loading.
  const payload = live !== undefined ? live : cached;
  if (payload === undefined) return { state: "loading" };
  if (payload === null) return { state: "notFound" };

  const { username, isOwner, days } = payload;
  if (live === undefined) return { state: "reloading", username, isOwner };

  const lastWithData = lastDayWithData(days);
  if (lastWithData === undefined) return { state: "empty", username, isOwner };

  // Pointing wins while it lands inside the Range; otherwise the panel rests on
  // the most recent day that has data.
  const selectedKey =
    hovered !== null && days.some((d) => d.dayKey === hovered)
      ? hovered
      : lastWithData.dayKey;

  // The chart is zero-filled, so a flat stretch can still be pointed at. Such a
  // day gets no Day detail at all, rather than ۰:۰۰ over an empty list.
  const pointed = days.find((d) => d.dayKey === selectedKey);
  const selected =
    pointed !== undefined && pointed.totalMs > 0 ? pointed : undefined;

  return { state: "ready", username, isOwner, days, selectedKey, selected };
}

/** The most recent day carrying focus time. `days` is oldest first. */
function lastDayWithData(days: readonly FocusDay[]): FocusDay | undefined {
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].totalMs > 0) return days[i];
  }
  return undefined;
}

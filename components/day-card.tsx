"use client";

import {
  useCallback,
  useSyncExternalStore,
} from "react";
import { bannerFor } from "@/lib/banners";
import { copy } from "@/lib/copy";
import type { FocusDay, FocusSlice } from "@/lib/focus-history";
import { faDate, faDuration, faHourClock } from "@/lib/format";

function sliceLabel(slice: FocusSlice): string {
  if (slice.name !== undefined) return slice.name;
  return slice.bucket === "private"
    ? copy.profile.privateBucket
    : copy.profile.noTask;
}

// The assignment never changes after mount, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

/**
 * The image for `key`, from the visit's banner assignment.
 *
 * The draw has to happen on the client — a cached server render would hand
 * every visitor the same sequence — so it goes through useSyncExternalStore:
 * null while rendering on the server and during hydration, the assigned image
 * immediately after.
 */
export function useBanner(banners: string[], key: string): string | null {
  const getSnapshot = useCallback(
    () => bannerFor(banners, key),
    [banners, key],
  );
  return useSyncExternalStore(noSubscribe, getSnapshot, () => null);
}

/**
 * One day's detail: the headline total, then the per-category breakdown.
 * (No image — the avatar lives in the profile header, not on each day card.)
 */
export function DayCard({
  day,
}: {
  day: FocusDay;
}) {
  // No image here: the avatar lives in the profile header, so each day card
  // is just the total and its per-category breakdown.
  return (
    <section className="mt-10">
        {/* A plain row already puts the first child on the right under dir=rtl,
            which is where the total belongs; the image trails on the left. */}
        <div className="flex flex-col justify-center">
          <h3 className="truncate text-xs text-muted-foreground">
            {faDate(day.dayKey)}
          </h3>
          {/* The unit sits under the clock rather than beside it: a bare h:mm
              says nothing about what was counted, and at this size there is no
              room alongside on a phone. */}
          <p className="mt-1 text-4xl leading-none font-bold sm:text-6xl">
            {faHourClock(day.totalMs)}
          </p>
          {/* Set like the clock, not like a caption: the two read as one
              phrase, so the unit should not look like a footnote to it. */}
          <p className="mt-1.5 text-base font-bold sm:text-lg">
            {copy.profile.focusedHours}
          </p>
        </div>
        <ul className="mt-4 space-y-3">
          {day.slices.map((slice) => (
            <li key={sliceLabel(slice)}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span
                  className={`truncate ${
                    slice.name === undefined ? "text-muted-foreground" : ""
                  }`}
                >
                  {sliceLabel(slice)}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {faDuration(slice.ms)}
                </span>
              </div>
              <div className="mt-1.5 h-1 w-full bg-secondary">
                <div
                  className="h-full bg-chart-1"
                  style={{ width: `${(slice.ms / day.totalMs) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
    </section>
  );
}

"use client";

import Image from "next/image";
import { useCallback, useEffect, useSyncExternalStore } from "react";
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
  const getSnapshot = useCallback(() => bannerFor(banners, key), [banners, key]);
  return useSyncExternalStore(noSubscribe, getSnapshot, () => null);
}

/**
 * Warm every image up front. There are only a handful and they are tiny, and
 * pointing along the chart walks through days one per mouse move — without this
 * each first sighting would pop in and the scrub would read as stuttering.
 */
function usePreloadedBanners(banners: string[]) {
  useEffect(() => {
    for (const src of banners) {
      const img = new window.Image();
      img.src = src;
    }
  }, [banners]);
}

/**
 * One day's detail: the headline total beside that day's image, then the
 * per-category breakdown.
 */
export function DayCard({
  day,
  username,
  banners,
}: {
  day: FocusDay;
  username: string;
  banners: string[];
}) {
  usePreloadedBanners(banners);
  // Keyed by user, so navigating between two profiles doesn't hand them the
  // same sequence of images.
  const src = useBanner(banners, `${username}:${day.dayKey}`);

  // No rule above the card: the gap alone separates it from the chart.
  return (
    <section className="mt-10">
      {/* A plain row already puts the first child on the right under dir=rtl,
          which is where the total belongs; the image trails on the left. */}
      <div className="flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
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
        <div className="relative aspect-square w-1/2 shrink-0 overflow-hidden">
          <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-background/20 to-transparent" />
          {src !== null && (
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 32rem) 50vw, 16rem"
              // The sources are already hand-optimised AVIF (~10 KB each);
              // running them through the optimiser would re-encode them to a
              // larger WebP.
              unoptimized
              className="object-cover"
            />
          )}
        </div>
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

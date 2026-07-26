"use client";

import Image from "next/image";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { pickBanner } from "@/lib/banners";
import { copy } from "@/lib/copy";
import { faDate, faDuration, faHourClock } from "@/lib/format";

type Slice = { name?: string; bucket?: "private" | "none"; ms: number };
type Day = { dayKey: string; totalMs: number; slices: Slice[] };

function sliceLabel(slice: Slice): string {
  if (slice.name !== undefined) return slice.name;
  return slice.bucket === "private" ? copy.profile.privateBucket : copy.profile.noTask;
}

// The pick never changes after mount, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

// Draws are remembered for the page visit rather than the card's lifetime:
// changing range unmounts the card while the new range loads, and a day whose
// art came back different every time would read as a glitch. Keyed by user so
// navigating between two profiles doesn't hand them the same sequence.
const assigned = new Map<string, string>();
let lastDrawn: string | null = null;

/**
 * The image for one day: drawn at random the first time that day is shown and
 * kept from then on, so scrubbing back and forth across the chart never
 * reshuffles the art. Successive draws avoid each other, which keeps
 * neighbouring days from landing on the same picture.
 *
 * The draw has to happen on the client — a cached server render would hand
 * every visitor the same sequence — so it goes through useSyncExternalStore:
 * null while rendering on the server and during hydration, the picked image
 * immediately after.
 */
function useDayBanner(banners: string[], key: string): string | null {
  const getSnapshot = useCallback(() => {
    const seen = assigned.get(key);
    if (seen !== undefined) return seen;
    const picked = pickBanner(banners, lastDrawn);
    if (picked === null) return null;
    assigned.set(key, picked);
    lastDrawn = picked;
    return picked;
  }, [banners, key]);

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
 * per-category breakdown. This is exactly what `shareCard` captures, so
 * anything that should not appear in a shared PNG belongs outside it.
 */
export function DayCard({
  day,
  username,
  banners,
  ref,
}: {
  day: Day;
  username: string;
  banners: string[];
  ref?: React.Ref<HTMLElement>;
}) {
  usePreloadedBanners(banners);
  const src = useDayBanner(banners, `${username}:${day.dayKey}`);

  return (
    <section ref={ref} className="mt-6 border-t pt-4">
      {/* A plain row already puts the first child on the right under dir=rtl,
          which is where the total belongs; the image trails on the left. */}
      <div className="flex items-stretch gap-4">
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <h3 className="truncate text-xs text-muted-foreground">{faDate(day.dayKey)}</h3>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-5xl leading-none font-bold sm:text-6xl">
              {faHourClock(day.totalMs)}
            </span>
            <span className="text-sm text-muted-foreground">{copy.profile.hoursUnit}</span>
          </p>
        </div>
        <div className="relative aspect-square w-1/2 shrink-0 overflow-hidden bg-secondary">
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
              <span className={slice.name === undefined ? "text-muted-foreground" : ""}>
                {sliceLabel(slice)}
              </span>
              <span className="shrink-0 text-muted-foreground">{faDuration(slice.ms)}</span>
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

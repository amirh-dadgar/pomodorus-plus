"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { DayCard } from "@/components/day-card";
import { FocusChart } from "@/components/focus-chart";
import { ScreenshotButton } from "@/components/screenshot-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy, t } from "@/lib/copy";
import { faDigits } from "@/lib/format";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

// Placeholder for the chart + day-detail area, shown while a range loads.
function ChartAreaSkeleton() {
  return (
    <div>
      <Skeleton className="mt-4 h-44 w-full" />
      <div className="mt-6 border-t pt-4">
        <div className="flex items-stretch gap-4">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-28" />
          </div>
          <Skeleton className="aspect-square w-1/2 shrink-0" />
        </div>
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="mt-1.5 h-1 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Profile({ username, banners }: { username: string; banners: string[] }) {
  const [range, setRange] = useState<Range>(7);
  const [hovered, setHovered] = useState<string | null>(null);
  const live = useQuery(api.profiles.chart, { username, days: range });
  const cardRef = useRef<HTMLElement>(null);

  // Switching ranges resubscribes the query, which momentarily returns
  // undefined. Keep the last payload so the page shell (username, presets)
  // stays mounted and only the chart area falls back to a skeleton.
  const [cached, setCached] = useState<typeof live>(undefined);
  if (live !== undefined && live !== cached) setCached(live);
  const profile = live ?? cached;
  const rangeLoading = live === undefined;

  const days = profile?.days ?? [];
  const lastWithData = [...days].reverse().find((d) => d.totalMs > 0);
  // Hover wins while it points inside the range; otherwise the panel rests on
  // the most recent day that has data.
  const selectedKey =
    hovered && days.some((d) => d.dayKey === hovered) ? hovered : lastWithData?.dayKey;
  // A day with nothing on it has no card: the chart is zero-filled, so pointing
  // at a flat stretch would otherwise dwell on ۰:۰۰ under an empty bar list.
  const pointed = days.find((d) => d.dayKey === selectedKey);
  const selected = pointed !== undefined && pointed.totalMs > 0 ? pointed : undefined;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col p-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight">
          {copy.app.name}
        </Link>
      </header>
      {profile === undefined ? (
        <div className="pt-10">
          <Skeleton className="h-7 w-36" />
          <div className="mt-8 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </div>
          <ChartAreaSkeleton />
        </div>
      ) : profile === null ? (
        <p className="pt-20 text-center text-sm text-muted-foreground">{copy.profile.notFound}</p>
      ) : (
        <div className="pt-10">
          <h1 className="text-lg font-bold" dir="ltr">
            @{profile.username}
          </h1>
          {profile.isOwner && (
            <p className="mt-2 text-xs text-muted-foreground">{copy.profile.ownerNote}</p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {copy.profile.focusPerDay}
            </h2>
            <div className="flex" role="group">
              {RANGES.map((r) => (
                <Button
                  key={r}
                  size="xs"
                  variant={range === r ? "secondary" : "ghost"}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={range === r ? "" : "text-muted-foreground"}
                >
                  {t(copy.profile.rangeDays, { n: faDigits(r) })}
                </Button>
              ))}
            </div>
          </div>

          {rangeLoading ? (
            <ChartAreaSkeleton />
          ) : lastWithData === undefined ? (
            <p className="mt-6 text-sm text-muted-foreground">{copy.profile.empty}</p>
          ) : (
            <>
              <div className="mt-4">
                <FocusChart days={days} selectedKey={selectedKey} onSelect={setHovered} />
              </div>

              {/* A constant key, so the card fades once on the way in and once
                  on the way out — moving between two days that both have data
                  swaps the contents without restarting the fade. */}
              <AnimatePresence>
                {selected && (
                  <motion.div
                    key="day-card"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <DayCard
                      ref={cardRef}
                      day={selected}
                      username={profile.username}
                      banners={banners}
                    />
                    <ScreenshotButton target={cardRef} dayKey={selected.dayKey} />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </main>
  );
}

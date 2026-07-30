"use client";

import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { DayCard } from "@/components/day-card";
import { FocusChart } from "@/components/focus-chart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy, t } from "@/lib/copy";
import { focusHistory, type ChartPayload } from "@/lib/focus-history";
import { faDigits } from "@/lib/format";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

// Placeholder for the chart + day-detail area, shown while a range loads.
function ChartAreaSkeleton() {
  return (
    <div>
      <Skeleton className="mt-4 h-44 w-full" />
      <div className="mt-10">
        <div className="flex items-stretch gap-4">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-6 w-32" />
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

export function Profile({
  username,
  banners,
}: {
  username: string;
  banners: string[];
}) {
  const [range, setRange] = useState<Range>(7);
  const [hovered, setHovered] = useState<string | null>(null);
  const live = useQuery(api.profiles.chart, { username, days: range });

  // Switching ranges resubscribes the query, which momentarily returns
  // undefined. Keeping the last payload is what lets the page shell stay
  // mounted while only the chart area falls back to a skeleton — the focus
  // history module decides which of those two is happening.
  const [cached, setCached] = useState<ChartPayload | undefined>(undefined);
  if (live !== undefined && live !== cached) setCached(live);
  const view = focusHistory({ live, cached, hovered });

  return (
    <main className="flex flex-1 flex-col p-6">
      {view.state === "loading" ? (
        <div className="pt-10">
          <Skeleton className="h-7 w-36" />
          <div className="mt-8 flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-7 w-40" />
          </div>
          <ChartAreaSkeleton />
        </div>
      ) : view.state === "notFound" ? (
        <p className="pt-20 text-center text-sm text-muted-foreground">
          {copy.profile.notFound}
        </p>
      ) : (
        <div className="pt-10">
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

          {view.state === "reloading" ? (
            <ChartAreaSkeleton />
          ) : view.state === "empty" ? (
            <p className="mt-6 text-sm text-muted-foreground">
              {copy.profile.empty}
            </p>
          ) : (
            <>
              <div className="mt-4">
                <FocusChart
                  days={view.days}
                  selectedKey={view.selectedKey}
                  onSelect={setHovered}
                />
              </div>

              {/* Keyed by day, so moving between two days fades as well —
                  every card is its own arrival and departure. `wait` holds the
                  incoming one until the outgoing has gone: the two cards differ
                  in height with the category list, and running them together
                  would shunt the page around mid-fade. */}
              <AnimatePresence mode="wait">
                {view.selected && (
                  <motion.div
                    key={view.selected.dayKey}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    // `wait` means a scrub pays this twice per day crossed.
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <DayCard
                      day={view.selected}
                      username={view.username}
                      banners={banners}
                    />
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

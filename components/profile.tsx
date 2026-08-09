"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { DayCard, useBanner } from "@/components/day-card";
import { FocusChart } from "@/components/focus-chart";
import { PeepAvatar, loadPeep } from "@/components/peep-picker";
import { ShareCard } from "@/components/share-card";
import { subscribePeep } from "@/lib/peep-store";
import { type PeepSelection } from "@/lib/peeps-parts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy, t } from "@/lib/copy";
import { focusHistory, type ChartPayload } from "@/lib/focus-history";
import { localFocusHistory } from "@/lib/local-chart";
import { useLocalState, useTimerNow } from "@/lib/local/hooks";
import { faDigits } from "@/lib/format";
import { toPng } from "html-to-image";

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

/**
 * A range with no focus time in it. Given a picture and room to breathe rather
 * than a line of grey text, so a quiet week reads as a page in its own right —
 * which for a new account is the first thing the profile ever shows.
 *
 * Keyed on the profile alone, so switching Range doesn't reshuffle the art the
 * way it would if the range were part of the key.
 */
function EmptyRange({
  username,
  banners,
  peep,
  offline,
}: {
  username: string;
  banners: string[];
  /** The saved avatar (live state), falling back to storage on first paint. */
  peep: PeepSelection | null;
  /** Local-first view: never render an avatar — there is none offline. */
  offline?: boolean;
}) {
  const src = useBanner(banners, `${username}:empty`);
  // A saved Open Peeps avatar replaces the default illustration when present.
  // Offline/local profiles have no avatar, so we neither read localStorage
  // (which would mismatch SSR) nor paint one.
  const savedPeep = offline ? null : peep ?? loadPeep();

  return (
    <div className="mt-6 flex flex-col items-center gap-6 border p-12 text-center sm:p-20">
      {/* The same fade the day card puts over its image: the picture rises out
          of the page instead of sitting in a box on it. */}
      <div className="relative aspect-square w-36 shrink-0 overflow-hidden sm:w-44">
        <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-background/20 to-transparent" />
        {!offline && savedPeep ? (
          <PeepAvatar selection={savedPeep} className="h-full w-full" />
        ) : (
          src !== null && (
            <Image
              src={src}
              alt=""
              fill
              sizes="11rem"
              // Hand-optimised AVIF already; see the day card.
              unoptimized
              className="object-cover"
            />
          )
        )}
      </div>
      <p className="text-base font-bold sm:text-lg">
        {copy.profile.emptyTitle}
      </p>
    </div>
  );
}

// Signing out lives here because the profile is the only page a signed-in
// visitor has of their own; the nav bar is shared with signed-out visitors.
export function Profile({
  username,
  banners,
  offline = false,
}: {
  username: string;
  banners: string[];
  /** Local-first view: chart comes from LocalState, no login, no avatar. */
  offline?: boolean;
}) {
  const [range, setRange] = useState<Range>(7);
  const [hovered, setHovered] = useState<string | null>(null);
  // The saved avatar, kept in state so saving the picker re-renders live
  // (without a page refresh). Seeded from storage AFTER mount (not in the
  // initializer) so server and first client render agree on `null` and we
  // avoid a hydration mismatch — localStorage only exists on the client.
  // The read is deferred to a frame so it isn't a synchronous setState in the
  // effect (which would trip the hooks lint rule and can cascade renders).
  // We also subscribe to the peep store (notified by the picker on save) and
  // the `peep:updated` window event, so a save made from the nav (which lives
  // outside this component) still refreshes the header avatar instantly.
  const [peep, setPeep] = useState<PeepSelection | null>(null);
  useEffect(() => {
    const sync = () => setPeep(loadPeep());
    const id = requestAnimationFrame(sync);
    const unsub = subscribePeep(() => setPeep(loadPeep()));
    window.addEventListener("peep:updated", sync);
    return () => {
      cancelAnimationFrame(id);
      unsub();
      window.removeEventListener("peep:updated", sync);
    };
  }, []);
  const savedPeepAlways = peep;
  // Off-screen node captured by the "اسکرین شات" button. The live page is
  // never mutated; only this hidden composite is rasterized and downloaded.
  const shareRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  async function handleShare() {
    if (!shareRef.current || sharing) return;
    setSharing(true);
    try {
      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `pomodorus-${username}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // Ignore capture failures; the live page stays intact.
    } finally {
      setSharing(false);
    }
  }
  // Offline/local-first view: source the chart from LocalState, never touch
  // the server. The hooks below are still called unconditionally (rules of
  // hooks) but their results are only used in the online branch.
  const localState = useLocalState();
  const localNow = useTimerNow();
  // Always call the hook (rules of hooks); only actually fetch when online.
  // Online profiles pull their chart from the source deployment (tacit-clam-994)
  // via the /api/profile-chart proxy, since this site's functions live on a
  // different deployment. See feed.tsx for the same pattern.
  const [live, setLive] = useState<ChartPayload | undefined | null>(undefined);
  const [chartLoading, setChartLoading] = useState(false);
  useEffect(() => {
    if (offline) return;
    let cancelled = false;
    setChartLoading(true);
    fetch(`/api/profile-chart?username=${encodeURIComponent(username)}&days=${range}`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setLive(data);
      })
      .catch(() => {
        if (!cancelled) setLive(null);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [offline, username, range]);

  // Switching ranges resubscribes the query, which momentarily returns
  // undefined. Keeping the last payload is what lets the page shell stay
  // mounted while only the chart area falls back to a skeleton — the focus
  // history module decides which of those two is happening.
  const [cached, setCached] = useState<ChartPayload | undefined>(undefined);
  if (live !== undefined && live !== cached) setCached(live);
  const view = offline
    ? localFocusHistory({ state: localState, range, now: localNow, hovered })
    : focusHistory({ live, cached, hovered });

  // Someone else's profile is a public page — only its owner gets the button.
  const isOwner =
    view.state !== "loading" && view.state !== "notFound" && view.isOwner;

  return (
    <main className="flex flex-1 flex-col p-6">
      {/* The page's one heading, and the one control that isn't about the
          chart, at opposite ends of a single row. Held at the button's own
          height in every state — including the states with no button — so
          the row does not grow under the page when auth resolves. */}
      <div className="flex h-8 items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Avatar is account-only (offline/local users never build one). */}
          {!offline && savedPeepAlways ? (
            <PeepAvatar
              selection={savedPeepAlways}
              className="size-20 shrink-0 overflow-hidden rounded-full border bg-[#f4f4f5]"
            />
          ) : !offline ? (
            <span className="size-20 shrink-0 rounded-full border bg-[#f4f4f5]" />
          ) : null}
          <div className="flex flex-col justify-center">
            <span className="text-base font-medium">
              {offline ? copy.profile.guest ?? "مهمان" : username}
            </span>
          </div>
        </div>
        {/* The share button: captures the off-screen composite, never the live
            page, so the profile header stays put. */}
        {!offline && (
          <Button
            size="xs"
            variant="ghost"
            onClick={handleShare}
            disabled={sharing}
            aria-label={copy.profile.downloadAria}
          >
            {copy.profile.downloadAria}
          </Button>
        )}
      </div>

      {/* A gap above the chart so the header (avatar + controls) doesn't
          crowd it. */}
      {view.state === "loading" ? (
        <div className="mt-12">
          <div className="flex items-center justify-between gap-3">
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
        <div className="mt-12">
          <div className="flex items-center justify-between gap-3">
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
            <EmptyRange username={view.username} banners={banners} peep={peep} offline={offline} />
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
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
      {/* Off-screen share composition: captured by the screenshot button.
          Kept out of the visible layout so the live profile is untouched. */}
      <ShareCard
        ref={shareRef}
        username={username}
        peep={offline ? null : savedPeepAlways}
        day={view.state === "ready" ? (view.selected ?? null) : null}
      />
    </main>
  );
}

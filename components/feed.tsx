"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { faClock, enDigits } from "@/lib/format";
import { useOnline } from "@/lib/local/hooks";
import { isLive } from "@/lib/presence";

type FeedEntry = {
  id: string;
  username: string;
  kind: "work" | "shortBreak" | "longBreak";
  label: string | null;
  startedAt: number;
  durationMs: number;
};

export function Feed() {
  const [feed, setFeed] = useState<FeedEntry[] | null>(null);
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Pull the live feed from the source deployment's public REST API, so it
  // reflects who is working on the production deployment (tacit-clam-994)
  // even though this site's functions live elsewhere.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/feed", { cache: "no-store" });
        const data = (await res.json()) as FeedEntry[];
        if (!cancelled) setFeed(data);
      } catch {
        if (!cancelled) setFeed([]);
      }
    }
    load();
    const poll = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, []);

  // Presence rows self-expire at their end time; drop the ones the server
  // hasn't re-evaluated yet.
  const active = (feed ?? []).filter((e) => isLive(e, now));

  // The feed is live-only: offline it has nothing to show, and when nobody is
  // working it is simply absent — a card that pops in and out as people start
  // and finish beats an empty section that closes the landing page.
  if (!online || active.length === 0) return null;

  return (
    <section className="w-full rounded-none border border-border bg-card">
      <ul className="divide-y divide-border">
        {active.map((entry) => {
          const remainingMs = Math.min(
            entry.startedAt + entry.durationMs - now,
            entry.durationMs,
          );
          const isBreak = entry.kind !== "work";
          return (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <span dir="rtl" className="flex min-w-0 items-center gap-1.5">
                <Link
                  href={`/u/${entry.username}`}
                  className="min-w-0 truncate font-medium hover:underline [font-family:ui-sans-serif,system-ui,sans-serif]"
                >
                  {enDigits(entry.username)}
                </Link>
                <span className="min-w-0 truncate text-muted-foreground">
                  {" — "}
                  {isBreak
                    ? copy.feed.onBreak
                    : (entry.label ?? copy.feed.privateTask)}
                </span>
              </span>
              {!isBreak && (
                <span
                  className="shrink-0 font-mono tabular-nums text-muted-foreground"
                  dir="ltr"
                >
                  {faClock(remainingMs)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

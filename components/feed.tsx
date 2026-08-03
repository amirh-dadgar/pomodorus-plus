"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { copy } from "@/lib/copy";
import { faClock, enDigits } from "@/lib/format";
import { useOnline } from "@/lib/local/hooks";
import { isLive } from "@/lib/presence";

export function Feed() {
  const feed = useQuery(api.sessions.activeFeed);
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
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
              <span className="truncate">
                <Link
                  href={`/u/${entry.username}`}
                  className="font-medium hover:underline"
                >
                  {enDigits(entry.username)}
                </Link>
                <span className="text-muted-foreground">
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

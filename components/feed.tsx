"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { copy } from "@/lib/copy";
import { faClock } from "@/lib/format";
import { useOnline } from "@/lib/local/hooks";

export function Feed() {
  const feed = useQuery(api.sessions.activeFeed);
  const online = useOnline();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // The feed is live-only; offline it degrades to an honest little notice.
  if (!online) {
    return (
      <section className="w-full space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">{copy.feed.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.offline.feedOffline}</p>
      </section>
    );
  }

  // Presence rows self-expire at their end time; drop the ones the server
  // hasn't re-evaluated yet.
  const active = (feed ?? []).filter((e) => e.startedAt + e.durationMs > now);
  if (active.length === 0) return null;

  return (
    <section className="w-full space-y-3 border-t pt-6">
      <h2 className="text-sm font-medium text-muted-foreground">{copy.feed.title}</h2>
      <ul className="space-y-2">
        {active.map((entry) => {
          const remainingMs = Math.min(entry.startedAt + entry.durationMs - now, entry.durationMs);
          const isBreak = entry.kind !== "work";
          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">
                <Link href={`/u/${entry.username}`} className="font-medium hover:underline">
                  {entry.username}
                </Link>
                <span className="text-muted-foreground">
                  {" — "}
                  {isBreak ? copy.feed.onBreak : entry.label ?? copy.feed.privateTask}
                </span>
              </span>
              {!isBreak && (
                <span className="shrink-0 font-mono tabular-nums text-muted-foreground" dir="ltr">
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

"use client";

import { useQuery, useConvexAuth } from "convex/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { faClock } from "@/lib/format";

export function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const feed = useQuery(api.sessions.activeFeed);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col p-6">
      <header className="flex items-center justify-between">
        <span className="font-bold tracking-tight">{copy.app.name}</span>
        <Button asChild size="sm" variant="outline">
          <Link href={isAuthenticated ? "/app" : "/login"}>
            {isAuthenticated ? copy.landing.goWork : copy.landing.enter}
          </Link>
        </Button>
      </header>

      <section className="flex flex-col items-center gap-3 pt-20 pb-14 text-center">
        <h1 className="text-3xl font-black tracking-tight">{copy.landing.tagline}</h1>
        <p className="text-sm text-muted-foreground">{copy.landing.sub}</p>
      </section>

      <section className="w-full space-y-3 border-t pt-6">
        <h2 className="text-sm font-medium text-muted-foreground">{copy.landing.liveTitle}</h2>
        {feed === undefined ? null : feed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.landing.everyoneOffline}</p>
        ) : (
          <ul className="space-y-2">
            {feed.map((entry) => {
              const remainingMs = Math.min(entry.startedAt + entry.durationMs - now, entry.durationMs);
              const isBreak = entry.kind !== "work";
              const name = entry.username ? (
                <Link href={`/u/${entry.username}`} className="font-medium hover:underline">
                  {entry.name}
                </Link>
              ) : (
                <span className="font-medium">{entry.name}</span>
              );
              return (
                <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">
                    {name}
                    <span className="text-muted-foreground">
                      {" — "}
                      {isBreak ? copy.landing.onBreak : entry.label ?? copy.landing.privateTask}
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
        )}
      </section>
    </main>
  );
}

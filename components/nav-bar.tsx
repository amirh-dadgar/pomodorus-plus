"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Scan, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy";
import { faClock } from "@/lib/format";
import {
  useLocalIdentity,
  useLocalState,
  useTimerNow,
} from "@/lib/local/hooks";
import { endAt } from "@/lib/local/types";

const HIDE_ON = ["/login", "/offline"];

// Both auth CTAs and the placeholder that stands in for them share one box, so
// the bar is exactly as tall and the CTA exactly as wide before the auth state
// resolves as after. Wide enough for the longer of «لاگین کن» and «پروفایل».
const CTA_BOX = "h-8 min-w-24";

export function NavBar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const username = useLocalIdentity();
  const state = useLocalState();
  const now = useTimerNow();

  // How long the placeholder is willing to wait for the cached username
  // before settling for a link that always works.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (HIDE_ON.includes(pathname)) return null;

  const running = state.running;
  const remainingMs = running ? Math.max(0, endAt(running) - now) : null;

  return (
    // h-14 rather than padding alone: the bar keeps its height even in the
    // beat before the auth state resolves, so nothing below it ever moves.
    <header className="flex h-14 w-full shrink-0 items-center justify-between px-6">
      <Link href="/" aria-label={copy.app.name}>
        <Timer className="size-6" aria-hidden />
      </Link>
      {/* The badge sits inline-start of the CTA, so it materialises into empty
          space rather than pushing the CTA off the frame edge. */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        {remainingMs !== null && (
          <Button asChild size="sm" variant="outline">
            <Link
              href="/app"
              className="font-mono tabular-nums hover:text-foreground"
              dir="ltr"
            >
              <div className="w-10 flex justify-start">
                {faClock(remainingMs)}
              </div>
              <Scan size={15} className="text-rose-500 animate-pulse" />
            </Link>
          </Button>
        )}
        {/* Signed in but the username hasn't arrived yet is still "loading":
            guessing here is what used to flash the wrong CTA. It falls back
            to the timer once auth has settled, so a device that can't reach
            profiles.me is left with a working link rather than a pulse. */}
        {isLoading || (isAuthenticated && username === null && !settled) ? (
          <Skeleton className={`${CTA_BOX} rounded-none`} />
        ) : isAuthenticated ? (
          <Button asChild size="sm" variant="outline" className={CTA_BOX}>
            <Link href={username === null ? "/app" : `/u/${username}`}>
              {username === null ? copy.header.timer : copy.header.myProfile}
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className={CTA_BOX}>
            <Link href="/login">{copy.landing.enter}</Link>
          </Button>
        )}
      </nav>
    </header>
  );
}

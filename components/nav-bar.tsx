"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scan, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { faClock } from "@/lib/format";
import {
  useLocalIdentity,
  useLocalState,
  useTimerNow,
} from "@/lib/local/hooks";
import { endAt } from "@/lib/local/types";

const HIDE_ON = ["/login", "/offline"];

export function NavBar() {
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const username = useLocalIdentity();
  const state = useLocalState();
  const now = useTimerNow();

  if (HIDE_ON.includes(pathname)) return null;

  const running = state.running;
  const remainingMs = running ? Math.max(0, endAt(running) - now) : null;

  return (
    <header className="flex w-full items-center justify-between px-6 py-3 pb-0">
      <Link href="/" aria-label={copy.app.name}>
        <Timer className="size-6" aria-hidden />
      </Link>
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        {remainingMs !== null && (
          <Button asChild variant="outline">
            <Link
              href="/app"
              className="font-mono tabular-nums hover:text-foreground"
              dir="ltr"
            >
              <div className="w-5 flex justify-end">{faClock(remainingMs)}</div>
              <Scan size={15} className="text-rose-500 animate-pulse" />
            </Link>
          </Button>
        )}
        {!isLoading && !isAuthenticated && (
          <Button asChild size="sm" variant="outline">
            <Link href="/login">{copy.landing.enter}</Link>
          </Button>
        )}
        {!isLoading && isAuthenticated && username && (
          <Button variant="outline">
            <Link href={`/u/${username}`} className="hover:text-foreground">
              {copy.header.myProfile}
            </Link>
          </Button>
        )}
      </nav>
    </header>
  );
}

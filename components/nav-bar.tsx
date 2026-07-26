"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { faClock } from "@/lib/format";
import { useLocalIdentity, useLocalState, useTimerNow } from "@/lib/local/hooks";
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
    <header className="flex w-full items-center justify-between p-6 pb-0">
      <Link href="/" aria-label={copy.app.name}>
        <Timer className="size-6" aria-hidden />
      </Link>
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        {remainingMs !== null && (
          <Link href="/app" className="font-mono tabular-nums hover:text-foreground" dir="ltr">
            {faClock(remainingMs)}
          </Link>
        )}
        {!isLoading && !isAuthenticated && (
          <Button asChild size="sm" variant="outline">
            <Link href="/login">{copy.landing.enter}</Link>
          </Button>
        )}
        {!isLoading && isAuthenticated && username && (
          <Link href={`/u/${username}`} className="hover:text-foreground">
            {copy.header.myProfile}
          </Link>
        )}
      </nav>
    </header>
  );
}

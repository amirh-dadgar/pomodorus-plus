"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Feed } from "@/components/feed";
import { copy } from "@/lib/copy";

export function Landing() {
  const { isAuthenticated } = useConvexAuth();
  const target = isAuthenticated ? "/app" : "/login";
  const cta = isAuthenticated ? copy.landing.goWork : copy.landing.enter;

  return (
    <main className="flex flex-1 flex-col p-6">
      <section className="flex flex-col items-center gap-4 pt-20 pb-16 text-center">
        <Timer className="size-10 text-muted-foreground" aria-hidden />
        <h1 className="text-4xl tracking-tight">{copy.landing.tagline}</h1>
        <Button asChild variant="default">
          <Link href={target}>{cta}</Link>
        </Button>
      </section>

      <Feed />
    </main>
  );
}

"use client";

import { useConvexAuth } from "convex/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { copy } from "@/lib/copy";

// Both labels and the placeholder share one box. This is the loudest control
// on the page, so it waits for the auth state rather than guessing: rendering
// «لاگین کن» to a signed-in visitor and then swapping it is worse than a beat
// of grey.
const CTA_BOX = "h-11 w-40 mt-2";

export function LandingCta() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) return <Skeleton className={`${CTA_BOX} rounded-none`} />;

  return (
    <Button asChild size="lg" className={CTA_BOX}>
      <Link href={isAuthenticated ? "/app" : "/login"}>
        {isAuthenticated ? copy.landing.goWork : copy.landing.enter}
      </Link>
    </Button>
  );
}

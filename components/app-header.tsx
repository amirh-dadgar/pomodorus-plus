"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { copy } from "@/lib/copy";
import { useLocalIdentity } from "@/lib/local/hooks";

export function AppHeader() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  // Cached locally by the SyncEngine, so the header works offline too.
  const username = useLocalIdentity();

  return (
    <header className="mx-auto flex w-full max-w-lg items-center justify-between p-6 pb-0">
      <Link href="/" className="font-bold tracking-tight">
        {copy.app.name}
      </Link>
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        {username && (
          <Link href={`/u/${username}`} className="hover:text-foreground">
            {copy.header.myProfile}
          </Link>
        )}
        <button
          type="button"
          className="hover:text-foreground"
          onClick={async () => {
            await signOut().catch(() => {});
            router.push("/");
          }}
        >
          {copy.header.signOut}
        </button>
      </nav>
    </header>
  );
}

"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { copy } from "@/lib/copy";

export function AppHeader() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const username = useQuery(api.profiles.me);

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
            await signOut();
            router.push("/");
          }}
        >
          {copy.header.signOut}
        </button>
      </nav>
    </header>
  );
}

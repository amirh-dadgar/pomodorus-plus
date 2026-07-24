"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AppHeader() {
  const { signOut } = useAuthActions();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="mx-auto flex w-full max-w-md items-center justify-between p-6 pb-0">
      <Link href="/" className="font-bold tracking-tight">
        Pomodorus
      </Link>
      <nav className="flex items-center gap-4 text-sm text-muted-foreground">
        {pathname === "/history" ? (
          <Link href="/" className="hover:text-foreground">
            تایمر
          </Link>
        ) : (
          <Link href="/history" className="hover:text-foreground">
            تاریخچه
          </Link>
        )}
        <button
          type="button"
          className="hover:text-foreground"
          onClick={async () => {
            await signOut();
            router.push("/login");
          }}
        >
          خروج
        </button>
      </nav>
    </header>
  );
}

"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { copy } from "@/lib/copy";
import { faDate, faDuration } from "@/lib/format";

export function Profile({ username }: { username: string }) {
  const profile = useQuery(api.profiles.byUsername, { username });

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col p-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight">
          {copy.app.name}
        </Link>
      </header>
      {profile === undefined ? null : profile === null ? (
        <p className="pt-20 text-center text-sm text-muted-foreground">{copy.profile.notFound}</p>
      ) : (
        <div className="pt-10">
          <h1 className="text-lg font-bold" dir="ltr">
            @{profile.username}
          </h1>
          <h2 className="mt-8 mb-2 text-sm font-medium text-muted-foreground">
            {copy.profile.focusPerDay}
          </h2>
          {profile.days.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.profile.empty}</p>
          ) : (
            <ul className="divide-y">
              {profile.days.map((day) => (
                <li
                  key={day.dayKey}
                  className="flex items-baseline justify-between gap-3 py-3 text-sm"
                >
                  <span>{faDate(day.dayKey)}</span>
                  <span className="shrink-0 text-muted-foreground">{faDuration(day.totalMs)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}

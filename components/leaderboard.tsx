"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { faDuration } from "@/lib/format";

type Range = "today" | "week" | "month" | "all";

const RANGES: { key: Range; label: string }[] = [
  { key: "today", label: "امروز" },
  { key: "week", label: "این هفته" },
  { key: "month", label: "این ماه" },
  { key: "all", label: "همه" },
];

export function Leaderboard() {
  const [range, setRange] = useState<Range>("today");
  const ranking = useQuery(api.leaderboard_cache.cachedRanking, { range, limit: 50 });

  return (
    <main className="flex flex-1 flex-col items-center px-6 pb-10">
      <h1 className="mt-8 text-2xl font-bold">{copy.leaderboard?.title ?? "لیدربورد"}</h1>

      <div className="mt-6 flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm transition-colors",
              range === r.key
                ? "border-yellow-600 bg-yellow-600/10 text-yellow-600"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ol className="mt-8 w-full max-w-md space-y-2">
        {ranking === undefined && (
          <li className="text-center text-sm text-muted-foreground">در حال بارگذاری…</li>
        )}
        {ranking === null && (
          <li className="text-center text-sm text-muted-foreground">خطا در بارگذاری.</li>
        )}
        {ranking && ranking.length === 0 && (
          <li className="text-center text-sm text-muted-foreground">
            هنوز کسی توی این بازه تمرکز نکرده.
          </li>
        )}
        {ranking?.map((row, i) => (
          <li
            key={row.username}
            className="flex items-center justify-between rounded-lg border px-4 py-3"
          >
            <span className="flex items-center gap-3">
              <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                {i + 1}
              </span>
              <span className="font-medium">{row.username}</span>
            </span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {faDuration(row.ms)}
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}

"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { FocusChart } from "@/components/focus-chart";
import { copy, t } from "@/lib/copy";
import { faDate, faDigits, faDuration } from "@/lib/format";

const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

type Slice = { name?: string; bucket?: "private" | "none"; ms: number };

function sliceLabel(slice: Slice): string {
  if (slice.name !== undefined) return slice.name;
  return slice.bucket === "private" ? copy.profile.privateBucket : copy.profile.noTask;
}

export function Profile({ username }: { username: string }) {
  const [range, setRange] = useState<Range>(7);
  const [hovered, setHovered] = useState<string | null>(null);
  const profile = useQuery(api.profiles.chart, { username, days: range });

  const days = profile?.days ?? [];
  const lastWithData = [...days].reverse().find((d) => d.totalMs > 0);
  // Hover wins while it points inside the range; otherwise the panel rests on
  // the most recent day that has data.
  const selectedKey =
    hovered && days.some((d) => d.dayKey === hovered) ? hovered : lastWithData?.dayKey;
  const selected = days.find((d) => d.dayKey === selectedKey);

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
          {profile.isOwner && (
            <p className="mt-2 text-xs text-muted-foreground">{copy.profile.ownerNote}</p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              {copy.profile.focusPerDay}
            </h2>
            <div className="flex" role="group">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-xs transition-colors ${
                    range === r
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(copy.profile.rangeDays, { n: faDigits(r) })}
                </button>
              ))}
            </div>
          </div>

          {lastWithData === undefined ? (
            <p className="mt-6 text-sm text-muted-foreground">{copy.profile.empty}</p>
          ) : (
            <>
              <div className="mt-4">
                <FocusChart days={days} selectedKey={selectedKey} onSelect={setHovered} />
              </div>

              {selected && (
                <section className="mt-6 min-h-32 border-t pt-4">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <h3 className="font-medium">{faDate(selected.dayKey)}</h3>
                    <span className="shrink-0 text-muted-foreground">
                      {faDuration(selected.totalMs)}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {selected.slices.map((slice) => (
                      <li key={sliceLabel(slice)}>
                        <div className="flex items-baseline justify-between gap-3 text-xs">
                          <span className={slice.name === undefined ? "text-muted-foreground" : ""}>
                            {sliceLabel(slice)}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {faDuration(slice.ms)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full bg-secondary">
                          <div
                            className="h-full bg-chart-1"
                            style={{ width: `${(slice.ms / selected.totalMs) * 100}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
}

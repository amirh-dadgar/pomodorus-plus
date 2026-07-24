"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { faDate, faDigits, faDuration } from "@/lib/format";

export function History() {
  const days = useQuery(api.sessions.history);

  return (
    <div className="mx-auto w-full max-w-md flex-1 p-6">
      <h1 className="mb-6 text-lg font-medium">تاریخچه تمرکز</h1>
      {days === undefined ? null : days.length === 0 ? (
        <p className="text-sm text-muted-foreground">هنوز جلسه‌ای تمام نشده است.</p>
      ) : (
        <ul className="divide-y">
          {days.map((day) => (
            <li key={day.dayKey} className="flex items-baseline justify-between gap-3 py-3 text-sm">
              <span>{faDate(day.dayKey)}</span>
              <span className="shrink-0 text-muted-foreground">
                {faDigits(day.sessionCount)} پومودورو — {faDuration(day.totalMs)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

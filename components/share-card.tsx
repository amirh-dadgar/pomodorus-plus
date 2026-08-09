"use client";

import { forwardRef } from "react";
import { PeepAvatar } from "@/components/peep-picker";
import { DayCard } from "@/components/day-card";
import { copy } from "@/lib/copy";
import type { FocusDay } from "@/lib/focus-history";
import type { PeepSelection } from "@/lib/peeps-parts";
import { faDate, faHourClock } from "@/lib/format";

/**
 * The off-screen composition captured by the "اسکرین شات" button.
 *
 * Layout mirrors the original project's share image: the day card on one side,
 * and the user's profile (avatar when they have one, otherwise just the name)
 * on the other — replacing the anime illustration that used to sit there.
 *
 * This is never shown on screen; it is rendered once, measured by
 * html-to-image, and downloaded. The live profile page is untouched.
 */
export const ShareCard = forwardRef<
  HTMLDivElement,
  {
    username: string;
    peep: PeepSelection | null;
    day: FocusDay | null;
  }
>(function ShareCard({ username, peep, day }, ref) {
  return (
    <div
      ref={ref}
      dir="rtl"
      style={{
        position: "fixed",
        left: -10000,
        top: 0,
        width: 720,
        padding: 32,
        background: "#ffffff",
        color: "#0a0a0a",
        fontFamily:
          "ui-sans-serif, system-ui, 'Segoe UI', Tahoma, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div className="flex items-center gap-5">
        {peep ? (
          <PeepAvatar
            selection={peep}
            className="size-24 shrink-0 overflow-hidden rounded-full border bg-[#f4f4f5]"
          />
        ) : (
          <span className="size-24 shrink-0 rounded-full border bg-[#f4f4f5]" />
        )}
        <div className="flex flex-col justify-center">
          <span className="text-lg font-medium">{username}</span>
        </div>
      </div>

      <div className="mt-6">
        {day ? (
          <div>
            <h3 className="truncate text-xs text-neutral-500">
              {faDate(day.dayKey)}
            </h3>
            <p className="mt-1 text-4xl leading-none font-bold">
              {faHourClock(day.totalMs)}
            </p>
            <p className="mt-1.5 text-base font-bold">
              {copy.profile.focusedHours}
            </p>
            <ul className="mt-4 space-y-3">
              {day.slices.map((slice) => {
                const label =
                  slice.name !== undefined
                    ? slice.name
                    : slice.bucket === "private"
                      ? copy.profile.privateBucket
                      : copy.profile.noTask;
                return (
                  <li key={label}>
                    <div className="flex items-baseline justify-between gap-3 text-xs">
                      <span
                        className={`truncate ${
                          slice.name === undefined ? "text-neutral-500" : ""
                        }`}
                      >
                        {label}
                      </span>
                      <span className="shrink-0 text-neutral-500">
                        {copy.profile.focusedHours}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 w-full bg-neutral-200">
                      <div
                        className="h-full bg-neutral-900"
                        style={{
                          width: `${(slice.ms / day.totalMs) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">بدون داده</p>
        )}
      </div>
    </div>
  );
});

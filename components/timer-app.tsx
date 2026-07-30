"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/convex/_generated/api";
import { copy, t } from "@/lib/copy";
import { faClock, faDigits, faDuration } from "@/lib/format";
import { playDing, unlockAudio } from "@/lib/sound";
import { CategoryPicker } from "@/components/category-picker";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Minus, Play, Plus, SkipForward, X } from "lucide-react";
import {
  useLocalIdentity,
  useLocalState,
  useOnline,
  useTimerNow,
} from "@/lib/local/hooks";
import { effectiveCategories } from "@/lib/local/device";
import { cancelWork, skipBreak, startWork } from "@/lib/local/store";
import { WORK_MINUTES, endAt, type SessionKind } from "@/lib/local/types";

const KIND_LABEL: Record<SessionKind, string> = {
  work: copy.timer.kindWork,
  shortBreak: copy.timer.kindShortBreak,
  longBreak: copy.timer.kindLongBreak,
};

type DurationChoice = (typeof WORK_MINUTES)[number];

/**
 * How much focus the server has recorded for this Tehran day.
 *
 * The one part of the timer screen that isn't local-first
 * (docs/adr/0002-todays-focus-from-the-server.md), so it has three ways of
 * having no number: signed out, still loading, and offline. All three render
 * as an empty row of the same height — only a total the server actually
 * confirmed is allowed to say «امروز تمرکز نکردی کلا».
 */
function TodayFocus() {
  const { isAuthenticated } = useConvexAuth();
  const online = useOnline();
  const today = useQuery(api.sessions.todayFocus, isAuthenticated ? {} : "skip");

  return (
    <div className="flex h-5 items-center justify-center">
      {today === undefined && isAuthenticated && online ? (
        <Skeleton className="h-3.5 w-40 rounded-none" />
      ) : today ? (
        <p className="text-sm text-muted-foreground">
          {today.count === 0
            ? copy.timer.todayEmpty
            : t(copy.timer.todaySummary, {
                count: faDigits(today.count),
                duration: faDuration(today.totalMs),
              })}
        </p>
      ) : null}
    </div>
  );
}

export function TimerApp() {
  // The timer is local-first: everything below renders from the local
  // store; the server is only involved via the SyncEngine in the layout.
  const identity = useLocalIdentity();
  const state = useLocalState();
  const { isAuthenticated } = useConvexAuth();
  const now = useTimerNow();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [choice, setChoice] = useState<DurationChoice>(25);

  // Ask for notification permission once, right after login.
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const running = state.running;
  const remainingMs = running ? Math.max(0, endAt(running) - now) : null;

  // Live countdown in the tab title: just the clock, nothing else.
  useEffect(() => {
    document.title =
      running && remainingMs !== null ? faClock(remainingMs) : copy.app.name;
    return () => {
      document.title = copy.app.name;
    };
  }, [running, remainingMs]);

  // Notify + ding when a session completes. Driven by the local lastEnded
  // (cancels and skips don't set it), so it fires offline too. Completions
  // settled retroactively — from a period the app was closed — are stale
  // and stay silent.
  const lastEnded = state.lastEnded;
  const seenEndedId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (seenEndedId.current === undefined) {
      seenEndedId.current = lastEnded?.id ?? null;
      return;
    }
    if (!lastEnded || lastEnded.id === seenEndedId.current) return;
    seenEndedId.current = lastEnded.id;
    if (Date.now() - lastEnded.at > 60_000) return;
    playDing();
    if ("Notification" in window && Notification.permission === "granted") {
      if (lastEnded.kind === "work") {
        new Notification(copy.notifications.workDoneTitle, {
          body: copy.notifications.workDoneBody,
          tag: "pomodorus",
        });
      } else {
        new Notification(copy.notifications.breakDoneTitle, {
          body: copy.notifications.breakDoneBody,
          tag: "pomodorus",
        });
      }
    }
  }, [lastEnded]);

  // No cached identity: either the first online visit is still loading the
  // username, or this device has never signed in and is offline.
  if (identity === null) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {isAuthenticated ? "…" : copy.offline.needInternet}
      </div>
    );
  }

  // cycleCount stays at 4 during the long break, then resets to 0.
  const cycleDots = Array.from(
    { length: 4 },
    (_, i) => i < Math.min(state.cycleCount, 4),
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6">
      {running && remainingMs !== null ? (
        <section className="flex w-full flex-col items-center gap-6">
          <p className="text-muted-foreground">
            {running.kind === "work"
              ? (effectiveCategories(state).find(
                  (c) => c.clientId === running.categoryClientId,
                )?.name ?? copy.timer.privateTask)
              : KIND_LABEL[running.kind]}
          </p>
          <p
            className="font-mono text-7xl font-bold tabular-nums tracking-tight"
            dir="ltr"
          >
            {faClock(remainingMs)}
          </p>
          {/* Elapsed share of the session. Measured against the real end time,
              so a dev fast session fills over its three seconds rather than
              creeping along its nominal 25 minutes. Fills from the right,
              inheriting the page's RTL direction. */}
          <div className="h-1 w-full max-w-xs bg-muted" aria-hidden>
            <div
              className="h-full bg-foreground transition-[width] duration-500 ease-linear"
              style={{
                width: `${(1 - remainingMs / (endAt(running) - running.startedAt)) * 100}%`,
              }}
            />
          </div>
          <div
            className="flex gap-2"
            title={t(copy.timer.cycleTitle, { n: faDigits(state.cycleCount) })}
          >
            {cycleDots.map((filled, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-none ${filled ? "bg-foreground" : "bg-muted"}`}
              />
            ))}
          </div>
          {running.kind === "work" ? (
            <Button
              variant="ghost"
              onClick={cancelWork}
            >
              <div className="flex items-center gap-1">
                <X size={10} />
                {copy.timer.cancelWork}
              </div>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={skipBreak}
            >
              <SkipForward />
              {copy.timer.skipBreak}
            </Button>
          )}
        </section>
      ) : (
        <div className="w-full grid">
          <CategoryPicker selected={categoryId} onSelect={setCategoryId} />

          <section className="flex w-full flex-col border border-t-0 px-10 py-20 items-center gap-6">
            {/* The clock is the control: ± steps between the two durations,
                and the button for the end you are already on is disabled. */}
            <div className="flex items-center gap-4" dir="ltr">
              <Button
                variant="outline"
                size="icon"
                aria-label={t(copy.timer.minutes, { m: faDigits(25) })}
                disabled={choice === 25}
                onClick={() => setChoice(25)}
              >
                <Minus className="size-4" />
              </Button>
              <p className="font-mono text-7xl font-bold tabular-nums tracking-tight">
                {faClock(choice * 60_000)}
              </p>
              <Button
                variant="outline"
                size="icon"
                aria-label={t(copy.timer.minutes, { m: faDigits(55) })}
                disabled={choice === 55}
                onClick={() => setChoice(55)}
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <Button
              size="lg"
              className="w-40"
              disabled={categoryId === null}
              onClick={() => {
                // User gesture: the only moment browsers reliably allow the
                // permission prompt and unlocking audio playback.
                unlockAudio();
                if (
                  "Notification" in window &&
                  Notification.permission === "default"
                ) {
                  Notification.requestPermission();
                }
                if (categoryId !== null) {
                  startWork(
                    categoryId,
                    choice,
                    process.env.NODE_ENV === "development",
                  );
                }
              }}
            >
              <Play />
              {copy.timer.start}
            </Button>
            <TodayFocus />
          </section>
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
}

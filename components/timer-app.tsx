"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { copy, t } from "@/lib/copy";
import { faClock, faDigits, faDuration } from "@/lib/format";
import { playDing, unlockAudio } from "@/lib/sound";
import { CategoryPicker } from "@/components/category-picker";
import { Play, SkipForward, X } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";

type Running = {
  id: Id<"sessions">;
  kind: "work" | "shortBreak" | "longBreak";
  startedAt: number;
  durationMs: number;
  categoryName: string | null;
};

const KIND_LABEL: Record<Running["kind"], string> = {
  work: copy.timer.kindWork,
  shortBreak: copy.timer.kindShortBreak,
  longBreak: copy.timer.kindLongBreak,
};

// Dev-only: a 3s session that's stored/credited as a full 25 minutes.
const SHOW_FAST_OPTION = process.env.NODE_ENV === "development";
type DurationChoice = 25 | 55 | "fast";

export function TimerApp() {
  const state = useQuery(api.sessions.myState);
  const startWork = useMutation(api.sessions.startWork);
  const cancelWork = useMutation(api.sessions.cancelWork);
  const skipBreak = useMutation(api.sessions.skipBreak);

  const [now, setNow] = useState(() => Date.now());
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);
  const [choice, setChoice] = useState<DurationChoice>(25);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  // Ask for notification permission once, right after login.
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const running = state?.running ?? null;
  // Clamp for clock skew: the server's startedAt can be ahead of local time.
  const remainingMs = running
    ? Math.min(running.startedAt + running.durationMs - now, running.durationMs)
    : null;

  // Live countdown in the tab title.
  useEffect(() => {
    document.title =
      running && remainingMs !== null
        ? `${faClock(remainingMs)} — ${KIND_LABEL[running.kind]}`
        : copy.app.name;
    return () => {
      document.title = copy.app.name;
    };
  }, [running, remainingMs]);

  // Notify + ding when a session completes. Driven by the server's
  // lastEnded (only naturally-completed sessions land there — cancels and
  // skips don't), so it also works for devFast sessions that end with most
  // of their nominal duration left.
  const lastEnded = state?.lastEnded ?? null;
  const seenEndedId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (state === undefined) return;
    // First loaded state: remember where we are, don't notify for the past.
    if (seenEndedId.current === undefined) {
      seenEndedId.current = lastEnded?.id ?? null;
      return;
    }
    if (!lastEnded || lastEnded.id === seenEndedId.current) return;
    seenEndedId.current = lastEnded.id;
    // Ignore completions that happened while the tab wasn't around.
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
  }, [state, lastEnded]);

  if (state === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">…</div>;
  }
  if (state === null) return null;

  // cycleCount stays at 4 during the long break, then resets to 0.
  const cycleDots = Array.from({ length: 4 }, (_, i) => i < Math.min(state.cycleCount, 4));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6">
      {running && remainingMs !== null ? (
        <section className="flex w-full flex-col items-center gap-6">
          <p className="text-muted-foreground">
            {running.kind === "work"
              ? running.categoryName ?? copy.timer.privateTask
              : KIND_LABEL[running.kind]}
          </p>
          <p className="font-mono text-7xl font-bold tabular-nums tracking-tight" dir="ltr">
            {faClock(remainingMs)}
          </p>
          <div className="flex gap-2" title={t(copy.timer.cycleTitle, { n: faDigits(state.cycleCount) })}>
            {cycleDots.map((filled, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${filled ? "bg-foreground" : "bg-muted"}`}
              />
            ))}
          </div>
          {running.kind === "work" ? (
            <Button variant="outline" onClick={() => cancelWork().catch(() => {})}>
              <X />
              {copy.timer.cancelWork}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => skipBreak().catch(() => {})}>
              <SkipForward />
              {copy.timer.skipBreak}
            </Button>
          )}
        </section>
      ) : (
        <section className="flex w-full flex-col items-center gap-6">
          <p className="font-mono text-7xl font-bold tabular-nums tracking-tight" dir="ltr">
            {faClock(choice === "fast" ? 3_000 : choice * 60_000)}
          </p>
          <CategoryPicker selected={categoryId} onSelect={setCategoryId} />
          <div className="flex gap-2" dir="ltr">
            {([25, 55] as const).map((m) => (
              <Button
                key={m}
                variant={choice === m ? "default" : "outline"}
                size="sm"
                onClick={() => setChoice(m)}
              >
                {t(copy.timer.minutes, { m: faDigits(m) })}
              </Button>
            ))}
            {SHOW_FAST_OPTION && (
              <Button
                variant={choice === "fast" ? "default" : "outline"}
                size="sm"
                onClick={() => setChoice("fast")}
              >
                {copy.timer.fastOption}
              </Button>
            )}
          </div>
          <Button
            size="lg"
            className="w-40"
            disabled={categoryId === null}
            onClick={() => {
              // User gesture: the only moment browsers reliably allow the
              // permission prompt and unlocking audio playback.
              unlockAudio();
              if ("Notification" in window && Notification.permission === "default") {
                Notification.requestPermission();
              }
              if (categoryId !== null) {
                startWork({
                  categoryId,
                  minutes: choice === "fast" ? 25 : choice,
                  ...(choice === "fast" ? { fast: true } : {}),
                }).catch(() => {});
              }
            }}
          >
            <Play />
            {copy.timer.start}
          </Button>
          <p className="text-sm text-muted-foreground">
            {state.todayCount > 0
              ? t(copy.timer.todaySummary, {
                  count: faDigits(state.todayCount),
                  duration: faDuration(state.todayMs),
                })
              : copy.timer.todayEmpty}
          </p>
        </section>
      )}
    </div>
  );
}

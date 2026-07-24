"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { faClock, faDigits, faDuration } from "@/lib/format";
import { CategoryPicker } from "@/components/category-picker";
import { Feed } from "@/components/feed";
import type { Id } from "@/convex/_generated/dataModel";

type Running = {
  id: Id<"sessions">;
  kind: "work" | "shortBreak" | "longBreak";
  startedAt: number;
  durationMs: number;
  categoryName: string | null;
};

const KIND_LABEL: Record<Running["kind"], string> = {
  work: "تمرکز",
  shortBreak: "استراحت",
  longBreak: "استراحت طولانی",
};

export function TimerApp() {
  const state = useQuery(api.sessions.myState);
  const startWork = useMutation(api.sessions.startWork);
  const cancelWork = useMutation(api.sessions.cancelWork);
  const skipBreak = useMutation(api.sessions.skipBreak);

  const [now, setNow] = useState(() => Date.now());
  const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);
  const [minutes, setMinutes] = useState<25 | 55>(25);

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
        : "Pomodorus";
    return () => {
      document.title = "Pomodorus";
    };
  }, [running, remainingMs]);

  // Notify when a phase ends naturally (not on cancel/skip: those end with
  // plenty of time left, a natural end has ~0 remaining).
  const prevRunning = useRef<Running | null>(null);
  useEffect(() => {
    const prev = prevRunning.current;
    prevRunning.current = running;
    if (!prev || prev.id === running?.id) return;
    const endedNaturally = prev.startedAt + prev.durationMs - Date.now() <= 2000;
    if (!endedNaturally || !("Notification" in window) || Notification.permission !== "granted") {
      return;
    }
    if (prev.kind === "work") {
      new Notification("پومودورو تمام شد", { body: "استراحت شروع شد." });
    } else {
      new Notification("استراحت تمام شد", { body: "آماده‌ی جلسه بعدی؟" });
    }
  }, [running]);

  if (state === undefined) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">…</div>;
  }
  if (state === null) return null;

  // cycleCount stays at 4 during the long break, then resets to 0.
  const cycleDots = Array.from({ length: 4 }, (_, i) => i < Math.min(state.cycleCount, 4));

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-10 p-6">
      {running && remainingMs !== null ? (
        <section className="flex w-full flex-col items-center gap-6 pt-10">
          <p className="text-muted-foreground">
            {running.kind === "work" ? running.categoryName ?? "تسک خصوصی" : KIND_LABEL[running.kind]}
          </p>
          <p className="font-mono text-7xl font-bold tabular-nums tracking-tight" dir="ltr">
            {faClock(remainingMs)}
          </p>
          <div className="flex gap-2" title={`${faDigits(state.cycleCount)} از ۴ جلسه`}>
            {cycleDots.map((filled, i) => (
              <span
                key={i}
                className={`h-2 w-2 rounded-full ${filled ? "bg-foreground" : "bg-muted"}`}
              />
            ))}
          </div>
          {running.kind === "work" ? (
            <Button variant="outline" onClick={() => cancelWork().catch(() => {})}>
              لغو جلسه
            </Button>
          ) : (
            <Button variant="outline" onClick={() => skipBreak().catch(() => {})}>
              رد کردن استراحت
            </Button>
          )}
        </section>
      ) : (
        <section className="flex w-full flex-col items-center gap-6 pt-10">
          <CategoryPicker selected={categoryId} onSelect={setCategoryId} />
          <div className="flex gap-2" dir="ltr">
            {([25, 55] as const).map((m) => (
              <Button
                key={m}
                variant={minutes === m ? "default" : "outline"}
                size="sm"
                onClick={() => setMinutes(m)}
              >
                {faDigits(m)} دقیقه
              </Button>
            ))}
          </div>
          <Button
            size="lg"
            className="w-40"
            disabled={categoryId === null}
            onClick={() => {
              if (categoryId !== null) {
                startWork({ categoryId, minutes }).catch(() => {});
              }
            }}
          >
            شروع
          </Button>
          <p className="text-sm text-muted-foreground">
            {state.todayCount > 0
              ? `امروز: ${faDigits(state.todayCount)} پومودورو — ${faDuration(state.todayMs)}`
              : "امروز هنوز جلسه‌ای تمام نشده"}
          </p>
        </section>
      )}

      <Feed now={now} />
    </div>
  );
}

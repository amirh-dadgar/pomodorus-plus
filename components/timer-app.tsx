"use client";

import { useConvexAuth } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { copy, t } from "@/lib/copy";
import { faClock, faDigits } from "@/lib/format";
import { playDing, unlockAudio } from "@/lib/sound";
import { CategoryPicker } from "@/components/category-picker";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Minus, Play, Plus, SkipForward, X } from "lucide-react";
import {
  useLocalIdentity,
  useLocalState,
  useTimerNow,
} from "@/lib/local/hooks";
import {
  cancelWork,
  effectiveCategories,
  skipBreak,
  startWork,
} from "@/lib/local/store";
import { endAt, type SessionKind } from "@/lib/local/types";

const KIND_LABEL: Record<SessionKind, string> = {
  work: copy.timer.kindWork,
  shortBreak: copy.timer.kindShortBreak,
  longBreak: copy.timer.kindLongBreak,
};

type DurationChoice = 25 | 55;

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
              onClick={() => {
                try {
                  cancelWork();
                } catch {}
              }}
            >
              <div className="flex items-center gap-1">
                <X size={10} />
                {copy.timer.cancelWork}
              </div>
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                try {
                  skipBreak();
                } catch {}
              }}
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
            <div className="flex items-center gap-4" dir="ltr">
              <Button
                variant="outline"
                size="icon"
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
                  try {
                    startWork(
                      categoryId,
                      choice,
                      process.env.NODE_ENV === "development",
                    );
                  } catch {}
                }
              }}
            >
              <Play />
              {copy.timer.start}
            </Button>
          </section>
        </div>
      )}
      <OfflineIndicator />
    </div>
  );
}

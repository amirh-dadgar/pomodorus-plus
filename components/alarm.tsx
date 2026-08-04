"use client";

import { useEffect } from "react";
import { copy } from "@/lib/copy";
import { useLocalState, useTimerNow } from "@/lib/local/hooks";
import { startAlarm, stopAlarm, unlockAudio } from "@/lib/sound";

/**
 * The ringing alarm, mounted once in the root layout beside the SyncEngine.
 *
 * It lives above the route on purpose: a session that ends while you are
 * reading someone's profile — or the landing page — has to be able to reach
 * you, or the app has silently swallowed the one thing it promised not to.
 *
 * Headless. The ring's *screen* is in the timer app; this is only the noise.
 */
export function Alarm() {
  const state = useLocalState();
  // Drives the 2Hz settle, so a session ends into `ringing` even on a route
  // that renders nothing of the timer.
  useTimerNow();

  const ringing = state.ringing;
  const id = ringing?.id ?? null;
  const audible = ringing?.audible ?? false;
  const kind = ringing?.kind;

  // Whether it *sounds* was decided when the ring was born, so this only has
  // to follow. Stopping on unmount matters: a ring confirmed in another tab
  // arrives here as `ringing: null` through the storage event.
  useEffect(() => {
    if (!audible) return;
    startAlarm();
    return stopAlarm;
  }, [audible, id]);

  // A reload destroys the AudioContext, and browsers will not rebuild it
  // without a gesture — so an alarm that was already ringing comes back mute.
  // Any interaction anywhere in the app is enough to bring it back.
  useEffect(() => {
    if (!audible) return;
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, [audible]);

  // One notification per ring, not one per ding: re-firing on the ding cadence
  // re-alerts on most platforms and is intolerable. `requireInteraction` is the
  // notification-shaped version of nagging — it stays on screen until dismissed
  // instead of fading after a few seconds.
  useEffect(() => {
    if (id === null || !audible) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const work = kind === "work";
    new Notification(
      work ? copy.notifications.workDoneTitle : copy.notifications.breakDoneTitle,
      {
        body: work ? copy.notifications.workDoneBody : copy.notifications.breakDoneBody,
        tag: "pomodorus",
        requireInteraction: true,
      },
    );
  }, [id, audible, kind]);

  return null;
}

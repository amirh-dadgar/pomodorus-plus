"use client";

import { useEffect } from "react";

/**
 * Registers the offline service worker. Production only: a service worker
 * caching dev-server responses makes local development miserable.
 */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}

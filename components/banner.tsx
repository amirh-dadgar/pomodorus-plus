"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pickBanner } from "@/lib/banners";

const LAST_KEY = "pomodorus:banner";

// The pick never changes after mount, so there is nothing to subscribe to.
const noSubscribe = () => () => {};

/**
 * A random banner, drawn fresh on every mount so each visit shows a different
 * image, and never the one drawn last time.
 *
 * The draw has to happen on the client — the server doesn't know what this
 * visitor saw last, and a cached response would hand everyone the same image —
 * so it goes through useSyncExternalStore: null while rendering on the server
 * and during hydration, the picked banner immediately after. The box holds its
 * aspect ratio from the first paint, so the arriving image shifts nothing.
 */
export function Banner({ banners }: { banners: string[] }) {
  const picked = useRef<string | null | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  const getSnapshot = useCallback(() => {
    if (picked.current === undefined) {
      picked.current = pickBanner(banners, window.localStorage.getItem(LAST_KEY));
    }
    return picked.current;
  }, [banners]);

  const src = useSyncExternalStore(noSubscribe, getSnapshot, () => null);

  // Remembered for the next visit, which is what keeps two in a row apart.
  useEffect(() => {
    if (src !== null) window.localStorage.setItem(LAST_KEY, src);
  }, [src]);

  if (banners.length === 0) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-secondary">
      {src !== null && (
        <Image
          src={src}
          alt=""
          fill
          sizes="(max-width: 32rem) 100vw, 32rem"
          // The sources are already hand-optimised AVIF (~10 KB each); running
          // them through the optimiser would re-encode them to a larger WebP.
          unoptimized
          onLoad={() => setLoaded(true)}
          className={`object-cover transition-opacity duration-500 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

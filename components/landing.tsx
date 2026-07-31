import Image from "next/image";
import { TriangleAlert } from "lucide-react";
// A fixed image rather than a draw from lib/banners like the profile does: a
// random pick would either pop in on the client or vary per request, and the
// hero is the first thing painted.
//
// Imported rather than written as a path so the URL carries a content hash.
// Note Turbopack can't decode AVIF, so the import is only ever a string — no
// intrinsic width/height and no blurDataURL — which is why the image is sized
// by its wrapper below instead of by the import.
import hero from "@/public/main.avif";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Feed } from "@/components/feed";
import { LandingCta } from "@/components/landing-cta";
import { copy } from "@/lib/copy";

export function Landing() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Full-bleed to the content frame and cropped to a band: the source is
          square, and a square at this width would push everything that says
          what the app is below the fold. The wrapper owns the box, so the
          space is reserved before the image has loaded or been measured. */}
      <div className="relative overflow-hidden aspect-video w-full shrink-0 mt-5">
        {/* The title sits in the bottom of the scrim, where the gradient is
            opaque background — the only band where the type is legible
            whatever the image is doing behind it. The inset keeps a wide
            tracking-widest title off the frame edges. */}
        <div className="absolute left-0 right-0 top-0 bottom-0 z-5 bg-linear-to-t items-end via-background/50 from-background to-transparent flex justify-center px-6 pb-4">
          <h1 className="lg:text-6xl text-3xl text-center tracking-widest font-light uppercase text-yellow-600">
            {copy.landing.tagline}
          </h1>
        </div>
        <Image
          src={hero}
          alt=""
          fill
          // `priority` is deprecated as of Next 16; `preload` is the same
          // <link rel=preload> for what is unambiguously the LCP element.
          preload
          // The source is an already-optimal 11KB AVIF at 941px. Running it
          // through the optimizer re-encodes it to a 34KB WebP (42KB JPEG for
          // older clients) — three times the bytes for the LCP image.
          unoptimized
          sizes="(max-width: 36rem) 100vw, 36rem"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-8 px-6 sm:gap-10">
        {/* No second heading here: the tagline lives in the hero, and the page
            gets one h1, printed once. */}
        <section className="flex flex-col items-center gap-4">
          <p className="text-center text-sm text-muted-foreground sm:text-base">
            {copy.landing.pitch}
          </p>
          <LandingCta />
        </section>

        {/* After the CTA, not before it: the caveat qualifies the offer rather
            than being the first thing anyone reads about the app. */}
        <Alert>
          <TriangleAlert />
          <AlertTitle>{copy.landing.experimentalTitle}</AlertTitle>
          <AlertDescription>{copy.landing.experimental}</AlertDescription>
        </Alert>

        <p className="text-xs leading-7 text-muted-foreground sm:text-sm sm:leading-8">
          {copy.landing.sub}
        </p>

        <Feed />
      </div>
    </main>
  );
}

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
      <div className="relative aspect-video w-full shrink-0 mt-5">
        <div className="absolute left-0 right-0 top-0 bottom-0 z-5 bg-linear-to-t from-background to-transparent" />
        <Image
          src={hero}
          alt=""
          fill
          priority
          // The source is an already-optimal 11KB AVIF at 941px. Running it
          // through the optimizer re-encodes it to a 34KB WebP (42KB JPEG for
          // older clients) — three times the bytes for the LCP image.
          unoptimized
          sizes="(max-width: 36rem) 100vw, 36rem"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-10 px-6 py-10">
        <section className="flex flex-col items-start gap-4">
          <h1 className="text-4xl tracking-tight">{copy.landing.tagline}</h1>
          <p className="text-muted-foreground">{copy.landing.pitch}</p>
          <LandingCta />
        </section>

        {/* After the CTA, not before it: the caveat qualifies the offer rather
            than being the first thing anyone reads about the app. */}
        <Alert>
          <TriangleAlert />
          <AlertTitle>{copy.landing.experimentalTitle}</AlertTitle>
          <AlertDescription>{copy.landing.experimental}</AlertDescription>
        </Alert>

        <p className="text-sm leading-8 text-muted-foreground">
          {copy.landing.sub}
        </p>

        <Feed />
      </div>
    </main>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaGithub, FaClock } from "react-icons/fa6";
import { Feed } from "@/components/feed";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const REPO_URL = "https://github.com/amirh-dadgar/pomodorus-plus";

export function Landing() {
  const router = useRouter();
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
          <h1 dir="ltr" className="flex items-center justify-center gap-1 lg:text-6xl text-3xl text-center tracking-widest font-light uppercase text-yellow-600">
            Pomodorus<span className="text-4xl lg:text-5xl leading-none">+</span>
          </h1>
        </div>
        <Image
          src="/main-2.avif"
          alt=""
          fill
          // `priority` is deprecated as of Next 16; `preload` is the same
          // <link rel=preload> for what is unambiguously the LCP element.
          preload
          unoptimized
          sizes="(max-width: 36rem) 100vw, 36rem"
          className="object-cover"
        />
      </div>

      <div className="flex flex-col gap-4 px-6 pb-10 sm:gap-6">
        <div className="flex flex-col items-center gap-4">
          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <Button
              size="lg"
              className="h-11 w-40"
              onClick={() => {
                router.push("/app");
              }}
            >
              <FaClock className="mr-2 size-5" />
              {copy.header.timer}
            </Button>

            <Link
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "h-11 w-40"
              )}
            >
              <FaGithub className="size-5" />
              {copy.landing.github}
            </Link>
          </div>
        </div>

        <footer className="mt-4 border-t pt-4 text-center text-sm leading-7 text-muted-foreground">
          {copy.about.greeting}
          <a
            href="https://github.com/yazdanctx/pomodorus"
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-600 hover:underline"
          >
            {copy.about.yazdan}
          </a>
          {copy.about.tail}
          <a
            href={copy.about.bugUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-yellow-600 hover:underline"
          >
            {copy.about.bugLink}
          </a>
          .
        </footer>

        <div className="h-0.5 bg-linear-to-r from-transparent via-border to-transparent" />

        <Feed />
      </div>
    </main>
  );
}

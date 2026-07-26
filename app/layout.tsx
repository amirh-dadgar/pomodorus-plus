import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import "./globals.css";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { NavBar } from "@/components/nav-bar";
import { SwRegister } from "@/components/sw-register";
import { SyncEngine } from "@/components/sync-engine";
import { copy } from "@/lib/copy";

const peyda = localFont({
  src: [
    {
      path: "./fonts/PeydaFaNumWeb-Thin.woff2",
      weight: "100",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-ExtraLight.woff2",
      weight: "200",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-Black.woff2",
      weight: "900",
      style: "normal",
    },
    {
      path: "./fonts/PeydaFaNumWeb-ExtraBlack.woff2",
      weight: "950",
      style: "normal",
    },
  ],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: copy.app.name,
  description: copy.app.description,
};

export const viewport: Viewport = {
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html
        lang="fa"
        dir="rtl"
        className={`${peyda.variable} h-full antialiased`}
      >
        <body className="min-h-screen flex flex-col lg:bg-stone-950">
          <ConvexClientProvider>
            <SyncEngine />
            <SwRegister />
            <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col border-x-0 bg-background lg:border-x lg:border-border/50">
              <NavBar />
              {children}
            </div>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}

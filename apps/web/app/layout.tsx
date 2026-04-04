import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google";
import { Suspense } from "react";

import "@workspace/ui/globals.css";
import { cn } from "@workspace/ui/lib/utils";
import { Footer } from "@/components/sections/footer";
import { Masthead } from "@/components/sections/masthead";
import { SectionNav } from "@/components/sections/section-nav";
import { Ticker } from "@/components/sections/ticker";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://thekiwidex.co.nz"),
  title: "The Kiwidex — New Zealand Economy Dashboard",
  description:
    "Live NZ economic indicators updated daily: CPI, fuel prices, groceries, housing, exchange rates, and employment. Data from RBNZ, Stats NZ, REINZ, and more.",
  keywords: [
    "New Zealand economy",
    "NZ economic indicators",
    "CPI New Zealand",
    "NZ fuel prices",
    "NZ house prices",
    "NZ exchange rates",
    "NZ unemployment",
    "Kiwidex",
  ],
  authors: [{ name: "Jordan Burch", url: "https://jordanburch.dev" }],
  creator: "Jordan Burch",
  openGraph: {
    type: "website",
    locale: "en_NZ",
    url: "https://thekiwidex.co.nz",
    siteName: "The Kiwidex",
    title: "The Kiwidex — New Zealand Economy Dashboard",
    description:
      "Live NZ economic indicators updated daily: CPI, fuel prices, groceries, housing, exchange rates, and employment.",
    images: [
      {
        url: "https://thekiwidex.co.nz/api/og",
        width: 1200,
        height: 630,
        alt: "The Kiwidex — New Zealand Economy Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "The Kiwidex — New Zealand Economy Dashboard",
    description:
      "Live NZ economic indicators updated daily: CPI, fuel, groceries, housing, FX, employment.",
    images: ["https://thekiwidex.co.nz/api/og"],
  },
  alternates: {
    canonical: "https://thekiwidex.co.nz",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

const playfairDisplayHeading = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading",
});

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        notoSans.variable,
        playfairDisplayHeading.variable
      )}
      lang="en-NZ"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <div className="min-h-screen bg-[#f4f2ed]">
            <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
              <div className="px-6 py-6">
                <Masthead />
              </div>
              <SectionNav />
              <Suspense fallback={<TickerSkeleton />}>
                <Ticker />
              </Suspense>
              <main>{children}</main>
              <Footer />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

function TickerSkeletonItem() {
  return (
    <span className="inline-flex items-center gap-1.5 px-4">
      <span className="h-3 w-12 animate-pulse rounded bg-[#e8e4dc]" />
      <span className="h-3.5 w-14 animate-pulse rounded bg-[#ddd8cf]" />
      <span className="h-4 w-12 animate-pulse rounded bg-[#e8e4dc]" />
    </span>
  );
}

function TickerSkeleton() {
  return (
    <div className="flex items-center overflow-hidden py-2">
      {Array.from({ length: 6 }, (_, i) => (
        <span className="inline-flex items-center" key={i}>
          {i > 0 && (
            <span
              aria-hidden="true"
              className="mx-2 inline-block h-1 w-1 rounded-full bg-[#e5e0d5]"
            />
          )}
          <TickerSkeletonItem />
        </span>
      ))}
    </div>
  );
}

import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans, Playfair_Display } from "next/font/google";

import "@workspace/ui/globals.css";
import { cn } from "@workspace/ui/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://kiwidex.co.nz"),
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
    url: "https://kiwidex.co.nz",
    siteName: "The Kiwidex",
    title: "The Kiwidex — New Zealand Economy Dashboard",
    description:
      "Live NZ economic indicators updated daily: CPI, fuel prices, groceries, housing, exchange rates, and employment.",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Kiwidex — New Zealand Economy Dashboard",
    description:
      "Live NZ economic indicators updated daily: CPI, fuel, groceries, housing, FX, employment.",
    creator: "@jordanburchdev",
  },
  alternates: {
    canonical: "https://kiwidex.co.nz",
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

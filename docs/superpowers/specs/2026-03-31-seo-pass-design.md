# SEO Pass — The Kiwidex

**Date**: 2026-03-31
**Domain**: `thekiwidex.co.nz`
**Scope**: Full SEO setup for a single-page Next.js 16 economy dashboard

---

## 1. Metadata (`layout.tsx`)

Export a `metadata` object from `layout.tsx` with:

```ts
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
  },
  twitter: {
    card: "summary_large_image",
    title: "The Kiwidex — New Zealand Economy Dashboard",
    description:
      "Live NZ economic indicators updated daily: CPI, fuel, groceries, housing, FX, employment.",
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
```

OG image is handled by the file convention (section 2), not inline here.

---

## 2. Dynamic OG Image (`app/opengraph-image.tsx`)

A route-level `opengraph-image.tsx` file using `ImageResponse` from `next/og`. Next.js auto-wires this as the OG image for the page.

**Design**: Newspaper-masthead aesthetic matching the site.

- **Size**: 1200x630 (standard OG)
- **Background**: `#faf8f3` (the site's cream/parchment)
- **Header**: "THE KIWIDEX" in Playfair Display bold, centered, with a thin rule underneath. Today's date below in small caps.
- **Metric grid**: 2 rows x 3 columns showing 6 key indicators:
  - OCR, CPI, NZD/USD (top row)
  - Petrol 91, Unemployment, Median House Price (bottom row)
- Each cell: metric name (small, muted), value (large, bold `#2a2520`), change arrow + percentage (green up / red down using `INDICATOR` colors).
- **Footer line**: `thekiwidex.co.nz` in small muted text.

**Data source**: Import DB query helpers from `@workspace/db` to fetch latest values at render time.

**Font loading**: Fetch Playfair Display and Noto Sans `.ttf` from Google Fonts at build/request time and pass as `fonts` option to `ImageResponse`. (Satori requires explicit font data, not `next/font`.)

**Caching**: Next.js caches OG images by default. Add `export const revalidate = 3600` (1 hour) so the image updates with fresh data reasonably often without hammering the DB.

Also create `app/twitter-image.tsx` that re-exports the same component (same image works for both).

---

## 3. Structured Data (JSON-LD)

Add a `<script type="application/ld+json">` in `layout.tsx` (or `page.tsx`) with two schemas:

**WebSite schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "The Kiwidex",
  "url": "https://thekiwidex.co.nz",
  "description": "Live New Zealand economic indicators dashboard"
}
```

**Dataset schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "Dataset",
  "name": "New Zealand Economic Indicators",
  "description": "Daily-updated collection of NZ economic metrics including CPI, fuel prices, grocery prices, housing, exchange rates, and employment data.",
  "url": "https://thekiwidex.co.nz",
  "creator": {
    "@type": "Person",
    "name": "Jordan Burch",
    "url": "https://jordanburch.dev"
  },
  "temporalCoverage": "2020/..",
  "spatialCoverage": "New Zealand",
  "variableMeasured": [
    "Consumer Price Index",
    "Official Cash Rate",
    "NZD Exchange Rates",
    "Fuel Prices",
    "Grocery Prices",
    "Median House Price",
    "Mortgage Rates",
    "Unemployment Rate",
    "Wage Growth"
  ],
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "isAccessibleForFree": true
}
```

These are static (no DB fetch needed). Placed as a `JsonLd` component rendered in `page.tsx`.

---

## 4. Sitemap (`app/sitemap.ts`)

Single-page sitemap:

```ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://thekiwidex.co.nz",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
```

---

## 5. Robots (`app/robots.ts`)

```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://thekiwidex.co.nz/sitemap.xml",
  };
}
```

---

## 6. Favicons

The existing `app/favicon.ico` stays. Add:

- `app/icon.svg` — an SVG favicon (simple "K" in Playfair style, dark on transparent). Modern browsers prefer SVG.
- `app/apple-icon.png` — 180x180 PNG for iOS home screen. Next.js auto-generates the `<link rel="apple-touch-icon">` from this file convention.

These can be static files or generated with `ImageResponse`. Static files are simpler and sufficient here.

---

## 7. Web App Manifest (`app/manifest.ts`)

```ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "The Kiwidex",
    short_name: "Kiwidex",
    description: "Live New Zealand economic indicators dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#faf8f3",
    theme_color: "#2a2520",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
```

---

## 8. Semantic HTML Audit

Quick check during implementation:
- Ensure only one `<h1>` on the page (the masthead "The Kiwidex" — verify this)
- Verify heading hierarchy (h1 > h2 > h3, no skips)
- Ensure all images have `alt` text
- Verify `<main>` wraps the content area
- Add `lang="en-NZ"` (currently `en` — more specific is better for NZ-targeted content)

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `apps/web/app/layout.tsx` | Add `metadata` export, update `lang` to `en-NZ` |
| `apps/web/app/page.tsx` | Add JSON-LD `<script>` component |
| `apps/web/app/opengraph-image.tsx` | Create — dynamic OG image with live data |
| `apps/web/app/twitter-image.tsx` | Create — re-export of OG image |
| `apps/web/app/sitemap.ts` | Create |
| `apps/web/app/robots.ts` | Create |
| `apps/web/app/icon.svg` | Create — SVG favicon |
| `apps/web/app/apple-icon.png` | Create — 180x180 touch icon |
| `apps/web/app/manifest.ts` | Create |

---

## Out of Scope

- Multi-page routing (it's a single page)
- Analytics/Search Console setup (deployment concern, not code)
- Performance optimization (separate pass)
- Accessibility audit beyond heading hierarchy (separate pass)

# "In the News" Section — Design Spec

## Overview

Add a curated NZ economy news section to the Kiwidex dashboard, sourced from RNZ and Stuff business RSS feeds. Displays the latest relevant headline as a hero card with image, plus 3 secondary headlines below.

**Placement:** Between Overview and Grocery Prices deep dive.

---

## Data Layer

### New `articles` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `url` | text | PRIMARY KEY | Canonical dedup key |
| `title` | text | NOT NULL | Headline |
| `excerpt` | text | NOT NULL | First ~200 chars from RSS `<description>` |
| `imageUrl` | text | nullable | Stuff: from `<media:content>`. RNZ: from og:image secondary fetch. |
| `source` | text | NOT NULL | `"rnz"` or `"stuff"` |
| `publishedAt` | text | NOT NULL | ISO date from RSS `<pubDate>` |
| `createdAt` | text | NOT NULL | Ingestion timestamp |

**Location:** `packages/db/src/schema.ts` — add alongside existing `metrics` and `products` tables.

### Query helper

`getLatestArticles(db, limit: number)` in `packages/db`:
- Returns most recent N articles ordered by `publishedAt` DESC
- Exported from the package for use by the web app

---

## Collector

### `apps/ingestion/src/collectors/news/index.ts`

**RSS Sources:**
- RNZ Business: `https://www.rnz.co.nz/rss/business.xml` (RSS 2.0 format)
- Stuff Business: `https://www.stuff.co.nz/rss?section=/business` (Atom format)

Note: The two feeds use different formats and must be parsed differently:
- **RNZ (RSS 2.0):** `<item>` → `<title>`, `<link>`, `<description>` (CDATA), `<pubDate>`, `<guid>`. **No image tags in the feed.**
- **Stuff (Atom):** `<entry>` → `<title>`, `<link href="...">`, `<summary>`, `<published>`, `<updated>`, `<media:content url="...">` (1240x700 images on every entry).

**Pipeline:**
1. Fetch both RSS feeds (plain HTTP, no Playwright needed)
2. Parse XML per format:
   - RNZ: RSS 2.0 — extract from `<item>` tags
   - Stuff: Atom — extract from `<entry>` tags, image from `<media:content url="...">`
3. **RNZ image enrichment:** For each RNZ article that passes the keyword filter, do a secondary `fetch()` of the article URL and extract `og:image` from the HTML meta tags (plain HTTP — RNZ pages don't need JS rendering). Fall back to `null` if the fetch fails.
4. Keyword filter: check headline + excerpt against allowlist. Only keep articles matching at least one keyword.
5. Return as `CollectorResult[]`-style output, bulk insert into `articles` table (dedup by URL on conflict)

**Keyword allowlist** (derived from existing metric domains):
- Rates/monetary: `ocr`, `interest rate`, `cash rate`, `rbnz`, `reserve bank`, `monetary policy`
- Inflation/prices: `inflation`, `cpi`, `cost of living`, `price`
- Housing: `housing`, `house price`, `mortgage`, `property`, `rent`, `reinz`
- Fuel: `petrol`, `fuel`, `diesel`, `gas price`
- Groceries: `grocery`, `supermarket`, `food price`, `woolworths`, `pak'nsave`, `foodstuffs`
- Labour: `unemployment`, `job`, `wage`, `salary`, `income`, `employment`, `labour market`
- Currency/trade: `nzd`, `dollar`, `exchange rate`, `currency`, `trade`
- Macro: `gdp`, `economy`, `recession`, `growth`, `budget`, `fiscal`

**Matching:** Case-insensitive substring match. Article passes if headline OR excerpt contains at least one keyword.

**Registration:** Add to `src/collectors/registry.ts`. Include in `collect:fast` (RSS fetch is instant).

### Insert helper

`insertArticles(db, articles[])` in `packages/db`:
- Bulk insert with `ON CONFLICT (url) DO UPDATE` to refresh title/excerpt/image if the source updates them
- Same pattern as existing `bulkInsert` and `insertProducts`

---

## Frontend

### Section component: `apps/web/components/sections/news-section.tsx`

Async Server Component. Fetches `getLatestArticles(db, 4)`.

**Layout (Option D — Hero Image + Bottom Row):**

1. **Section header** — matching existing `SectionHeader` pattern:
   - Eyebrow: "In the News"
   - Title: "Latest Headlines"
   - Subtitle: "Economy reporting from RNZ & Stuff"

2. **Hero card** — first (most recent) article:
   - Full-width image with gradient overlay at bottom
   - Source badge (RNZ dark, Stuff light) + relative timestamp on the overlay
   - Headline in large white text on the overlay
   - Excerpt in lighter text below headline
   - Entire card is an `<a>` linking to source article (`target="_blank"`, `rel="noopener"`)

3. **Bottom row** — 3 remaining articles in equal-width columns:
   - Source badge + relative timestamp
   - Headline text only (no image, no excerpt)
   - Each is a link to source article
   - Separated by vertical `#e5e0d5` borders

4. **Empty state** — if fewer than 4 articles, show what's available. If zero articles, omit the section entirely (don't render).

### Query function: `apps/web/lib/queries.ts`

`getNewsData()`:
- Calls `getLatestArticles(db, 4)`
- Returns the articles array directly (no transformation needed)

### Images

Article images are hotlinked from source. Add their domains to `next.config` `images.remotePatterns`:
- `www.rnz.co.nz` (og:image URLs)
- `media.rnz.co.nz` (some RNZ images hosted here)
- `resources.stuff.co.nz` (Stuff media:content URLs)

Use `next/image` with `fill` for the hero image. Fallback: if `imageUrl` is null, show a neutral gradient placeholder (matching the dashboard's warm tone palette).

### Relative timestamps

Utility function `timeAgo(isoDate: string): string`:
- < 1 hour: "X minutes ago"
- < 24 hours: "X hours ago"
- < 48 hours: "Yesterday"
- else: "X days ago"

Place in `apps/web/lib/data.ts` alongside existing formatters.

---

## Page integration

In `apps/web/app/page.tsx`, add `<NewsSection />` between `<Overview />` and the Grocery deep dive `<div>`:

```
<Overview />
</div>
<div className="border-[#e5e0d5] border-t">
  <NewsSection />
</div>
<div className="border-[#e5e0d5] border-t">
  <GroceryDeepDive />
</div>
```

---

## Design tokens

Consistent with existing dashboard:
- Background: `#faf9f6`
- Borders: `#e5e0d5`
- Heading text: `#2a2520`
- Body text: `#5a5550`
- Muted text/timestamps: `#998`
- RNZ badge: dark (`#2a2520` bg, `#faf9f6` text)
- Stuff badge: light (`#e8e3d8` bg, `#5a5550` text)
- Hero overlay gradient: `transparent → rgba(42,37,32,0.92)`
- Fallback image gradient: `linear-gradient(145deg, #4a4538, #3a3528, #5a5040)`

---

## Scope boundaries

**In scope:**
- `articles` table + schema migration
- News RSS collector with keyword filtering
- `insertArticles` + `getLatestArticles` DB helpers
- `NewsSection` Server Component with hero + bottom row layout
- `getNewsData` query function
- `timeAgo` utility
- `next.config` image domain allowlist
- Page integration

**Out of scope:**
- Article caching/staleness strategy (RSS runs on collect schedule, good enough)
- Search or filtering on the frontend
- Article categories or tagging beyond keyword filter
- RSS feed health monitoring
- Pagination or "view more" functionality

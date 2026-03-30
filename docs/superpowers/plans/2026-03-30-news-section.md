# "In the News" Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a curated NZ economy news feed to the Kiwidex dashboard, sourced from RNZ + Stuff RSS feeds, displayed as a hero image card + 3 headline row.

**Architecture:** New `articles` table in libSQL, new RSS collector in the ingestion service (fetches RSS, keyword-filters, enriches RNZ with og:image), new async Server Component on the web frontend. Follows existing collector → DB → Server Component pattern.

**Tech Stack:** Drizzle ORM, libSQL, Bun fetch, XML parsing, Next.js Server Components, next/image

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/schema.ts` (modify) | Add `articles` table definition |
| Create | `packages/db/src/queries.ts` (modify) | Add `insertArticles` + `getLatestArticles` |
| Modify | `packages/db/src/index.ts` | Export new table + query helpers |
| Create | `apps/ingestion/src/collectors/news/index.ts` | RSS fetch, parse, keyword filter, og:image enrichment |
| Create | `apps/ingestion/src/collectors/news/keywords.ts` | Keyword allowlist |
| Create | `apps/ingestion/src/collectors/news/parse-rss.ts` | RNZ RSS 2.0 parser |
| Create | `apps/ingestion/src/collectors/news/parse-atom.ts` | Stuff Atom parser |
| Modify | `apps/ingestion/src/collectors/registry.ts` | Register news collector |
| Modify | `apps/web/lib/data.ts` | Add `timeAgo` utility |
| Modify | `apps/web/lib/queries.ts` | Add `getNewsData` |
| Create | `apps/web/components/sections/news-section.tsx` | Hero + bottom row Server Component |
| Modify | `apps/web/app/page.tsx` | Insert `<NewsSection />` |
| Modify | `apps/web/next.config.mjs` | Add image remote patterns |

---

### Task 1: Articles Table Schema

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add articles table to schema**

Add after the `products` table definition in `packages/db/src/schema.ts`:

```typescript
export const articles = sqliteTable("articles", {
  url: text("url").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  imageUrl: text("image_url"),
  source: text("source").notNull(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Export from index**

In `packages/db/src/index.ts`, add `articles` to the schema export:

```typescript
export { articles, metrics, products, scraperRuns } from "./schema";
```

- [ ] **Step 3: Push schema to local DB**

Run: `bun run db:push`
Expected: Table `articles` created successfully.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/src/index.ts
git commit -m "feat(db): add articles table for news feed"
```

---

### Task 2: DB Query Helpers — insertArticles + getLatestArticles

**Files:**
- Modify: `packages/db/src/queries.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Add types and insertArticles to queries.ts**

Add these imports at the top of `packages/db/src/queries.ts`:

```typescript
import { articles } from "./schema";  // add to existing import
```

Add the type and function at the bottom of the file:

```typescript
export type NewArticle = typeof articles.$inferInsert;

export async function insertArticles(db: Db, items: NewArticle[]) {
  if (items.length === 0) {
    return;
  }

  for (const item of items) {
    await db
      .insert(articles)
      .values(item)
      .onConflictDoUpdate({
        target: [articles.url],
        set: {
          title: sql`excluded.title`,
          excerpt: sql`excluded.excerpt`,
          imageUrl: sql`excluded.image_url`,
          source: sql`excluded.source`,
          publishedAt: sql`excluded.published_at`,
          createdAt: new Date().toISOString(),
        },
      });
  }
}
```

- [ ] **Step 2: Add getLatestArticles to queries.ts**

Add below `insertArticles`:

```typescript
export async function getLatestArticles(db: Db, limit: number) {
  return db
    .select()
    .from(articles)
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}
```

- [ ] **Step 3: Export from index.ts**

In `packages/db/src/index.ts`, add the new exports:

```typescript
export {
  bulkInsert,
  getLastSuccessDate,
  getLatestArticles,
  getLatestByCategory,
  getLatestRuns,
  getLatestValue,
  getProductsByCategory,
  getStaleCollectors,
  getTimeSeries,
  insertArticles,
  insertProducts,
  insertScraperRun,
  type NewArticle,
  type NewProduct,
  type NewScraperRun,
  type ScraperRun,
} from "./queries";
```

- [ ] **Step 4: Verify build**

Run: `cd packages/db && bun run build` (or `bun run check` from root)
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/queries.ts packages/db/src/index.ts
git commit -m "feat(db): add insertArticles and getLatestArticles query helpers"
```

---

### Task 3: Keyword Filter

**Files:**
- Create: `apps/ingestion/src/collectors/news/keywords.ts`

- [ ] **Step 1: Create keyword allowlist**

Create `apps/ingestion/src/collectors/news/keywords.ts`:

```typescript
/**
 * Economy keyword allowlist — derived from the dashboard's metric domains.
 * An article passes if headline OR excerpt contains at least one keyword (case-insensitive).
 */
const ECONOMY_KEYWORDS = [
  // Rates / monetary
  "ocr",
  "interest rate",
  "cash rate",
  "rbnz",
  "reserve bank",
  "monetary policy",
  // Inflation / prices
  "inflation",
  "cpi",
  "cost of living",
  "price",
  // Housing
  "housing",
  "house price",
  "mortgage",
  "property",
  "rent",
  "reinz",
  // Fuel
  "petrol",
  "fuel",
  "diesel",
  "gas price",
  // Groceries
  "grocery",
  "supermarket",
  "food price",
  "woolworths",
  "pak'nsave",
  "foodstuffs",
  // Labour
  "unemployment",
  "job",
  "wage",
  "salary",
  "income",
  "employment",
  "labour market",
  // Currency / trade
  "nzd",
  "dollar",
  "exchange rate",
  "currency",
  "trade",
  // Macro
  "gdp",
  "economy",
  "recession",
  "growth",
  "budget",
  "fiscal",
];

export function matchesEconomyKeywords(
  title: string,
  excerpt: string
): boolean {
  const text = `${title} ${excerpt}`.toLowerCase();
  return ECONOMY_KEYWORDS.some((keyword) => text.includes(keyword));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ingestion/src/collectors/news/keywords.ts
git commit -m "feat(news): add economy keyword allowlist for article filtering"
```

---

### Task 4: RSS Parsers (RNZ + Stuff)

**Files:**
- Create: `apps/ingestion/src/collectors/news/parse-rss.ts`
- Create: `apps/ingestion/src/collectors/news/parse-atom.ts`

- [ ] **Step 1: Create shared article type**

Both parsers return the same shape. Add at the top of `parse-rss.ts` and export it:

Create `apps/ingestion/src/collectors/news/parse-rss.ts`:

```typescript
export interface ParsedArticle {
  url: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string;
}

/**
 * Parse RNZ Business RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description> (CDATA), <pubDate>, <guid>
 * No image tags in the feed — imageUrl will always be null here.
 */
export function parseRnzRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]!;

    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const description = extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate");

    if (!title || !link) continue;

    articles.push({
      url: link,
      title: stripCdata(title).trim(),
      excerpt: stripHtml(stripCdata(description ?? "")).slice(0, 200).trim(),
      imageUrl: null,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
  }

  return articles;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle both regular content and CDATA
  const regex = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) return null;
  return match[1] ?? match[2] ?? null;
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
```

- [ ] **Step 2: Create Stuff Atom parser**

Create `apps/ingestion/src/collectors/news/parse-atom.ts`:

```typescript
import type { ParsedArticle } from "./parse-rss";

/**
 * Parse Stuff Business Atom feed.
 * Fields: <entry> → <title>, <link href="...">, <summary>, <published>, <media:content url="...">
 */
export function parseStuffAtom(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1]!;

    const title = extractAtomTag(entry, "title");
    const link = extractAtomLink(entry);
    const summary = extractAtomTag(entry, "summary");
    const published = extractAtomTag(entry, "published");
    const imageUrl = extractMediaContent(entry);

    if (!title || !link) continue;

    articles.push({
      url: link,
      title: title.trim(),
      excerpt: (summary ?? "").slice(0, 200).trim(),
      imageUrl,
      publishedAt: published ? new Date(published).toISOString() : new Date().toISOString(),
    });
  }

  return articles;
}

function extractAtomTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractAtomLink(xml: string): string | null {
  // Atom links: <link href="..." rel="alternate" />  or  <link href="..." />
  const match = xml.match(/<link[^>]+href="([^"]+)"[^>]*\/?>/i);
  return match?.[1] ?? null;
}

function extractMediaContent(xml: string): string | null {
  const match = xml.match(/<media:content[^>]+url="([^"]+)"/i);
  return match?.[1] ?? null;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/src/collectors/news/parse-rss.ts apps/ingestion/src/collectors/news/parse-atom.ts
git commit -m "feat(news): add RNZ RSS 2.0 and Stuff Atom feed parsers"
```

---

### Task 5: News Collector

**Files:**
- Create: `apps/ingestion/src/collectors/news/index.ts`
- Modify: `apps/ingestion/src/collectors/registry.ts`

- [ ] **Step 1: Create the news collector**

Create `apps/ingestion/src/collectors/news/index.ts`:

```typescript
import { db, insertArticles, type NewArticle } from "@workspace/db";
import type { CollectorResult } from "../types";
import { matchesEconomyKeywords } from "./keywords";
import { parseStuffAtom } from "./parse-atom";
import { parseRnzRss, type ParsedArticle } from "./parse-rss";

const RNZ_FEED = "https://www.rnz.co.nz/rss/business.xml";
const STUFF_FEED = "https://www.stuff.co.nz/rss?section=/business";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Fetch og:image from an article page via plain HTTP.
 * RNZ pages are server-rendered — no JS needed.
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const match = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );
    // Also try the reverse attribute order
    if (!match) {
      const alt = html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );
      return alt?.[1] ?? null;
    }
    return match[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchFeed(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      console.warn(`[news] Feed ${url}: HTTP ${response.status}`);
      return null;
    }
    return response.text();
  } catch (e) {
    console.warn(`[news] Feed ${url} failed: ${e}`);
    return null;
  }
}

export default async function collectNews(): Promise<CollectorResult[]> {
  console.log("[news] Fetching RSS feeds...");

  const [rnzXml, stuffXml] = await Promise.all([
    fetchFeed(RNZ_FEED),
    fetchFeed(STUFF_FEED),
  ]);

  let allArticles: ParsedArticle[] = [];

  if (rnzXml) {
    const rnzArticles = parseRnzRss(rnzXml);
    console.log(`[news] RNZ: ${rnzArticles.length} items parsed`);
    allArticles.push(...rnzArticles.map((a) => ({ ...a, source: "rnz" })));
  }

  if (stuffXml) {
    const stuffArticles = parseStuffAtom(stuffXml);
    console.log(`[news] Stuff: ${stuffArticles.length} items parsed`);
    allArticles.push(...stuffArticles.map((a) => ({ ...a, source: "stuff" })));
  }

  // Keyword filter
  const filtered = allArticles.filter((a) =>
    matchesEconomyKeywords(a.title, a.excerpt)
  );
  console.log(
    `[news] ${filtered.length}/${allArticles.length} articles match economy keywords`
  );

  // Enrich RNZ articles with og:image (Stuff already has images from feed)
  const rnzToEnrich = filtered.filter(
    (a) => (a as ParsedArticle & { source: string }).source === "rnz" && !a.imageUrl
  );
  if (rnzToEnrich.length > 0) {
    console.log(`[news] Fetching og:image for ${rnzToEnrich.length} RNZ articles...`);
    await Promise.all(
      rnzToEnrich.map(async (article) => {
        article.imageUrl = await fetchOgImage(article.url);
      })
    );
    const enriched = rnzToEnrich.filter((a) => a.imageUrl).length;
    console.log(`[news] Got images for ${enriched}/${rnzToEnrich.length} RNZ articles`);
  }

  // Insert into articles table
  const rows: NewArticle[] = filtered.map((a) => ({
    url: a.url,
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: a.imageUrl,
    source: (a as ParsedArticle & { source: string }).source,
    publishedAt: a.publishedAt,
  }));

  await insertArticles(db, rows);
  console.log(`[news] Inserted/updated ${rows.length} articles`);

  // Return empty — news doesn't produce metric data points
  return [];
}
```

Note: The `source` field is carried through by spreading it onto the ParsedArticle. Since the type doesn't include `source`, we cast when reading it. A cleaner approach — add `source` as an optional field to `ParsedArticle` in `parse-rss.ts`:

In `parse-rss.ts`, update the interface:
```typescript
export interface ParsedArticle {
  url: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string;
  source?: string;
}
```

Then remove the casts in `index.ts` and access `.source` directly:
```typescript
// Replace the cast lines with:
allArticles.push(...rnzArticles.map((a) => ({ ...a, source: "rnz" })));
// ...
const rnzToEnrich = filtered.filter((a) => a.source === "rnz" && !a.imageUrl);
// ...
source: a.source ?? "unknown",
```

- [ ] **Step 2: Register in collector registry**

In `apps/ingestion/src/collectors/registry.ts`, add:

```typescript
import collectNews from "./news/index";
```

And add to the registry object:

```typescript
export const registry: Record<string, Collector> = {
  rbnz: collectRBNZ,
  "stats-nz": collectStatsNZ,
  reinz: collectREINZ,
  petrol: collectPetrol,
  electricity: collectElectricity,
  "minimum-wage": collectMinimumWage,
  "rent-vs-buy": collectRentVsBuy,
  news: collectNews,
  groceries: collectGroceries,
};
```

Place `news` before `groceries` so it runs early in `collect:fast` (it's fast, no reason to delay).

- [ ] **Step 3: Test collector locally**

Run: `cd apps/ingestion && bun run src/collect-all.ts --skip=groceries,rbnz,stats-nz,reinz,petrol,electricity,minimum-wage,rent-vs-buy`

Expected: Only the news collector runs. Output shows:
- RNZ/Stuff items parsed
- Keyword filter count
- og:image enrichment count
- Articles inserted

- [ ] **Step 4: Verify articles in DB**

Run: `cd packages/db && bunx drizzle-kit studio`

Open Drizzle Studio and check the `articles` table has rows with titles, excerpts, image URLs, and sources.

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/news/ apps/ingestion/src/collectors/registry.ts
git commit -m "feat(news): add RSS collector for RNZ + Stuff economy news"
```

---

### Task 6: Frontend — timeAgo Utility

**Files:**
- Modify: `apps/web/lib/data.ts`

- [ ] **Step 1: Add timeAgo function**

Add at the bottom of `apps/web/lib/data.ts`:

```typescript
export function timeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 2) {
    return "Yesterday";
  }
  return `${diffDays} days ago`;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/data.ts
git commit -m "feat(web): add timeAgo relative timestamp formatter"
```

---

### Task 7: Frontend — getNewsData Query

**Files:**
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Add getNewsData function**

Add this import at the top of `apps/web/lib/queries.ts`:

```typescript
import {
  getLatestArticles,
  getLatestValue,
  getTimeSeries,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
```

(Just add `getLatestArticles` to the existing import.)

Add at the bottom of the file:

```typescript
export async function getNewsData() {
  return getLatestArticles(db, 4);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/queries.ts
git commit -m "feat(web): add getNewsData query function"
```

---

### Task 8: Frontend — NewsSection Component

**Files:**
- Create: `apps/web/components/sections/news-section.tsx`

- [ ] **Step 1: Create the NewsSection component**

Create `apps/web/components/sections/news-section.tsx`:

```typescript
import Image from "next/image";
import { SectionHeader } from "@workspace/ui/components/section-header";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";

function SourceBadge({
  source,
  variant,
}: {
  source: string;
  variant: "dark" | "light";
}) {
  if (variant === "dark") {
    return (
      <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-[#faf9f6]">
        {source === "rnz" ? "RNZ" : "Stuff"}
      </span>
    );
  }
  return (
    <span className="rounded bg-[#e8e3d8] px-1.5 py-0.5 font-sans text-[9px] font-medium text-[#5a5550]">
      {source === "rnz" ? "RNZ" : "Stuff"}
    </span>
  );
}

export async function NewsSection() {
  const articles = await getNewsData();

  if (articles.length === 0) {
    return null;
  }

  const [hero, ...rest] = articles;

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ & Stuff"
        title="In the News"
      />

      {/* Hero card */}
      <a
        className="group relative block overflow-hidden rounded"
        href={hero!.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative h-[280px] w-full">
          {hero!.imageUrl ? (
            <Image
              alt={hero!.title}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 1200px) 100vw, 1152px"
              src={hero!.imageUrl}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(145deg, #4a4538, #3a3528, #5a5040)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(42,37,32,0.7) 50%, rgba(42,37,32,0.92) 100%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="mb-2 flex items-center gap-2">
              <SourceBadge source={hero!.source} variant="dark" />
              <span className="font-sans text-[10px] text-white/50">
                {timeAgo(hero!.publishedAt)}
              </span>
            </div>
            <h3 className="font-heading text-xl font-bold leading-tight text-white">
              {hero!.title}
            </h3>
            {hero!.excerpt && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                {hero!.excerpt}
              </p>
            )}
          </div>
        </div>
      </a>

      {/* Bottom row */}
      {rest.length > 0 && (
        <div className="mt-0 grid grid-cols-3 border-t border-[#e5e0d5]">
          {rest.map((article, i) => (
            <a
              key={article.url}
              className={`block px-4 py-4 transition-colors hover:bg-[#f0ecdf] ${
                i < rest.length - 1 ? "border-r border-[#e5e0d5]" : ""
              }`}
              href={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <SourceBadge source={article.source} variant="light" />
                <span className="font-sans text-[9px] text-[#998]">
                  {timeAgo(article.publishedAt)}
                </span>
              </div>
              <h4 className="font-heading text-[13px] font-semibold leading-snug text-[#2a2520]">
                {article.title}
              </h4>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/sections/news-section.tsx
git commit -m "feat(web): add NewsSection component with hero card + bottom row"
```

---

### Task 9: Page Integration + Image Config

**Files:**
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Add image remote patterns to next.config.mjs**

Update `apps/web/next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { hostname: "www.rnz.co.nz" },
      { hostname: "media.rnz.co.nz" },
      { hostname: "resources.stuff.co.nz" },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Add NewsSection to page.tsx**

In `apps/web/app/page.tsx`, add the import:

```typescript
import { NewsSection } from "@/components/sections/news-section";
```

Add the section between `<Overview />` and the Grocery deep dive. The current code has:

```tsx
<div className="px-6 py-8">
  <Overview />
</div>
<div className="border-[#e5e0d5] border-t">
  <GroceryDeepDive />
</div>
```

Change to:

```tsx
<div className="px-6 py-8">
  <Overview />
</div>
<div className="border-[#e5e0d5] border-t">
  <NewsSection />
</div>
<div className="border-[#e5e0d5] border-t">
  <GroceryDeepDive />
</div>
```

- [ ] **Step 3: Verify dev server**

Run: `bun run dev:web`

Open http://localhost:3000 and verify:
- "In the News" section appears between Overview and Grocery Prices
- Hero card shows image (or gradient fallback), headline, excerpt, source badge, timestamp
- Bottom row shows 3 headlines with source badges
- All links open in new tabs to the source articles

- [ ] **Step 4: Run lint check**

Run: `bun run check`
Expected: No lint or format errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/page.tsx apps/web/next.config.mjs
git commit -m "feat(web): integrate NewsSection into dashboard page"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Run full collect:fast**

Run: `bun run collect:fast`

Expected: All collectors run including news. News collector output shows articles parsed, filtered, and inserted.

- [ ] **Step 2: Verify the dashboard**

Run: `bun run dev:web`

Check http://localhost:3000:
- News section renders with real articles from RNZ and Stuff
- Images load correctly (not broken)
- Headlines are relevant to NZ economy (keyword filter working)
- Timestamps show relative time ("2 hours ago", "Yesterday", etc.)
- Clicking articles opens the source in a new tab

- [ ] **Step 3: Final commit (if any lint fixes needed)**

```bash
bun run fix
git add -A
git commit -m "fix: lint cleanup for news section"
```

# News Section Expansion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the news section from 2 sources / 4 articles to 4 sources / 7 articles with an importance-scoring algorithm to pick the lead story.

**Architecture:** Add NZ Herald and Newsroom RSS parsers alongside existing RNZ/Stuff. New importance scoring module ranks articles by keyword tier, recency, and cross-source coverage. Query fetches balanced mix from all 4 sources. Component updated to 1 lead + 6 cards (2 rows of 3).

**Tech Stack:** Bun fetch, XML regex parsing, Drizzle/libSQL, Next.js Server Components, next/image

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/ingestion/src/collectors/news/parse-herald.ts` | NZ Herald RSS 2.0 parser with `media:content` images |
| Create | `apps/ingestion/src/collectors/news/parse-newsroom.ts` | Newsroom WordPress RSS parser with CDATA image extraction |
| Create | `apps/ingestion/src/collectors/news/score.ts` | Importance scoring algorithm |
| Modify | `apps/ingestion/src/collectors/news/keywords.ts` | Add tiered keyword weights for scoring |
| Modify | `apps/ingestion/src/collectors/news/index.ts` | Add Herald + Newsroom feeds, apply scoring |
| Modify | `packages/db/src/queries.ts` | Update `getLatestArticles` for 4 sources |
| Modify | `apps/web/lib/queries.ts` | Update `getNewsData` for 7 articles |
| Modify | `apps/web/components/sections/news-section.tsx` | 1 lead + 6 cards (2 rows of 3), add Herald/Newsroom badges |
| Modify | `apps/web/next.config.mjs` | Add Herald + Newsroom image domains |

---

### Task 1: NZ Herald RSS Parser

**Files:**
- Create: `apps/ingestion/src/collectors/news/parse-herald.ts`

- [ ] **Step 1: Create the Herald parser**

Create `apps/ingestion/src/collectors/news/parse-herald.ts`:

```typescript
import type { ParsedArticle } from "./parse-rss";

/**
 * Parse NZ Herald Business RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description>, <pubDate>, <media:content url="..." />
 * Images available via media:content at multiple resolutions.
 * Feed URL: https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml
 */
export function parseHeraldRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  for (
    let match = itemRegex.exec(xml);
    match !== null;
    match = itemRegex.exec(xml)
  ) {
    const item = match[1]!;

    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const description = extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate");
    const imageUrl = extractMediaContent(item);

    if (!(title && link)) {
      continue;
    }

    articles.push({
      url: link,
      title: stripCdata(title).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
      imageUrl,
      publishedAt: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    });
  }

  return articles;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? null;
}

function extractMediaContent(xml: string): string | null {
  // Grab the largest media:content image (last one tends to be largest)
  const matches = [...xml.matchAll(/<media:content[^>]+url="([^"]+)"[^>]*>/gi)];
  if (matches.length === 0) {
    return null;
  }
  // Return the last match (typically the largest resolution)
  return matches.at(-1)?.[1] ?? null;
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ingestion/src/collectors/news/parse-herald.ts
git commit -m "feat(news): add NZ Herald RSS parser with media:content images"
```

---

### Task 2: Newsroom RSS Parser

**Files:**
- Create: `apps/ingestion/src/collectors/news/parse-newsroom.ts`

- [ ] **Step 1: Create the Newsroom parser**

Create `apps/ingestion/src/collectors/news/parse-newsroom.ts`:

```typescript
import type { ParsedArticle } from "./parse-rss";

/**
 * Parse Newsroom WordPress RSS 2.0 feed (economy category).
 * Fields: <item> → <title>, <link>, <description> (CDATA with <img>), <pubDate>, <content:encoded>
 * Images embedded as <img> tags inside CDATA description — need HTML extraction.
 * Feed URL: https://newsroom.co.nz/category/economy/feed/
 */
export function parseNewsroomRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  for (
    let match = itemRegex.exec(xml);
    match !== null;
    match = itemRegex.exec(xml)
  ) {
    const item = match[1]!;

    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const description = extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate");
    const imageUrl = extractImageFromHtml(description ?? "");

    if (!(title && link)) {
      continue;
    }

    articles.push({
      url: link,
      title: stripCdata(title).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
      imageUrl,
      publishedAt: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    });
  }

  return articles;
}

/**
 * Extract the first <img src="..."> from HTML content (inside CDATA).
 * Newsroom embeds article images in the description field.
 */
function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] ?? null;
}

function extractTag(xml: string, tag: string): string | null {
  const regex = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) {
    return null;
  }
  return match[1] ?? match[2] ?? null;
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ingestion/src/collectors/news/parse-newsroom.ts
git commit -m "feat(news): add Newsroom RSS parser with CDATA image extraction"
```

---

### Task 3: Tiered Keywords + Importance Scoring

**Files:**
- Modify: `apps/ingestion/src/collectors/news/keywords.ts`
- Create: `apps/ingestion/src/collectors/news/score.ts`

- [ ] **Step 1: Add tiered keyword weights to keywords.ts**

Replace the contents of `apps/ingestion/src/collectors/news/keywords.ts` with:

```typescript
/**
 * Economy keywords with importance tiers.
 * Tier 1 = macro/policy (high impact, affects everyone)
 * Tier 2 = sector-level (important, more specific)
 * Tier 3 = everyday economy (general, less "breaking")
 */

interface WeightedKeyword {
  keyword: string;
  tier: 1 | 2 | 3;
}

const WEIGHTED_KEYWORDS: WeightedKeyword[] = [
  // Tier 1 — macro/policy
  { keyword: "ocr", tier: 1 },
  { keyword: "rbnz", tier: 1 },
  { keyword: "reserve bank", tier: 1 },
  { keyword: "monetary policy", tier: 1 },
  { keyword: "gdp", tier: 1 },
  { keyword: "cpi", tier: 1 },
  { keyword: "recession", tier: 1 },
  { keyword: "cash rate", tier: 1 },
  { keyword: "fiscal", tier: 1 },
  { keyword: "budget", tier: 1 },
  // Tier 2 — sector-level
  { keyword: "interest rate", tier: 2 },
  { keyword: "inflation", tier: 2 },
  { keyword: "mortgage", tier: 2 },
  { keyword: "house price", tier: 2 },
  { keyword: "housing", tier: 2 },
  { keyword: "unemployment", tier: 2 },
  { keyword: "employment", tier: 2 },
  { keyword: "labour market", tier: 2 },
  { keyword: "property", tier: 2 },
  { keyword: "reinz", tier: 2 },
  { keyword: "cost of living", tier: 2 },
  { keyword: "exchange rate", tier: 2 },
  // Tier 3 — everyday
  { keyword: "petrol", tier: 3 },
  { keyword: "fuel", tier: 3 },
  { keyword: "diesel", tier: 3 },
  { keyword: "gas price", tier: 3 },
  { keyword: "grocery", tier: 3 },
  { keyword: "supermarket", tier: 3 },
  { keyword: "food price", tier: 3 },
  { keyword: "woolworths", tier: 3 },
  { keyword: "pak'nsave", tier: 3 },
  { keyword: "foodstuffs", tier: 3 },
  { keyword: "wage", tier: 3 },
  { keyword: "salary", tier: 3 },
  { keyword: "income", tier: 3 },
  { keyword: "job", tier: 3 },
  { keyword: "nzd", tier: 3 },
  { keyword: "dollar", tier: 3 },
  { keyword: "currency", tier: 3 },
  { keyword: "trade", tier: 3 },
  { keyword: "economy", tier: 3 },
  { keyword: "growth", tier: 3 },
  { keyword: "price", tier: 3 },
  { keyword: "rent", tier: 3 },
];

export function matchesEconomyKeywords(
  title: string,
  excerpt: string
): boolean {
  const text = `${title} ${excerpt}`.toLowerCase();
  return WEIGHTED_KEYWORDS.some((wk) => text.includes(wk.keyword));
}

/**
 * Return the highest tier matched (1 = most important, 3 = least).
 * Returns 0 if no keywords match.
 */
export function getKeywordTier(title: string, excerpt: string): number {
  const text = `${title} ${excerpt}`.toLowerCase();
  let bestTier = 0;
  for (const wk of WEIGHTED_KEYWORDS) {
    if (text.includes(wk.keyword)) {
      if (bestTier === 0 || wk.tier < bestTier) {
        bestTier = wk.tier;
      }
      if (bestTier === 1) {
        break; // Can't do better than tier 1
      }
    }
  }
  return bestTier;
}
```

- [ ] **Step 2: Create the scoring module**

Create `apps/ingestion/src/collectors/news/score.ts`:

```typescript
import type { ParsedArticle } from "./parse-rss";
import { getKeywordTier } from "./keywords";

export interface ScoredArticle extends ParsedArticle {
  score: number;
}

/**
 * Score articles by importance. Higher score = more important.
 *
 * Factors:
 * 1. Keyword tier: tier 1 = +30, tier 2 = +20, tier 3 = +10
 * 2. Recency: up to +25 points for articles from the last 6 hours, decaying over 48 hours
 * 3. Cross-source coverage: +15 per additional source covering the same topic
 */
export function scoreArticles(articles: ParsedArticle[]): ScoredArticle[] {
  const topicCounts = buildTopicCounts(articles);

  return articles.map((article) => {
    const tierScore = getKeywordTierScore(article);
    const recencyScore = getRecencyScore(article);
    const coverageScore = getCoverageScore(article, topicCounts);

    return {
      ...article,
      score: tierScore + recencyScore + coverageScore,
    };
  });
}

function getKeywordTierScore(article: ParsedArticle): number {
  const tier = getKeywordTier(article.title, article.excerpt);
  if (tier === 1) return 30;
  if (tier === 2) return 20;
  if (tier === 3) return 10;
  return 0;
}

function getRecencyScore(article: ParsedArticle): number {
  const ageMs = Date.now() - new Date(article.publishedAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours <= 6) return 25;
  if (ageHours <= 12) return 20;
  if (ageHours <= 24) return 15;
  if (ageHours <= 48) return 10;
  return 5;
}

/**
 * Detect cross-source coverage by extracting key terms from titles
 * and checking if multiple sources share them.
 */
function buildTopicCounts(
  articles: ParsedArticle[]
): Map<string, Set<string>> {
  const topicSources = new Map<string, Set<string>>();

  for (const article of articles) {
    const terms = extractTopicTerms(article.title);
    for (const term of terms) {
      if (!topicSources.has(term)) {
        topicSources.set(term, new Set());
      }
      topicSources.get(term)!.add(article.source ?? "unknown");
    }
  }

  return topicSources;
}

function getCoverageScore(
  article: ParsedArticle,
  topicCounts: Map<string, Set<string>>
): number {
  const terms = extractTopicTerms(article.title);
  let maxSources = 1;

  for (const term of terms) {
    const sources = topicCounts.get(term);
    if (sources && sources.size > maxSources) {
      maxSources = sources.size;
    }
  }

  // +15 per additional source beyond the first
  return (maxSources - 1) * 15;
}

/**
 * Extract significant topic terms from a title for cross-source matching.
 * Uses the economy keywords as the vocabulary.
 */
function extractTopicTerms(title: string): string[] {
  const text = title.toLowerCase();
  const TOPIC_TERMS = [
    "ocr", "rbnz", "reserve bank", "gdp", "cpi", "recession",
    "interest rate", "inflation", "mortgage", "house price", "housing",
    "unemployment", "petrol", "fuel", "grocery", "exchange rate",
    "budget", "fiscal", "trade", "employment",
  ];
  return TOPIC_TERMS.filter((term) => text.includes(term));
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/src/collectors/news/keywords.ts apps/ingestion/src/collectors/news/score.ts
git commit -m "feat(news): add tiered keywords and importance scoring algorithm"
```

---

### Task 4: Update Collector for 4 Sources + Scoring

**Files:**
- Modify: `apps/ingestion/src/collectors/news/index.ts`

- [ ] **Step 1: Update the collector**

Replace the contents of `apps/ingestion/src/collectors/news/index.ts` with:

```typescript
import { db, insertArticles, type NewArticle } from "@workspace/db";
import type { CollectorResult } from "../types";
import { matchesEconomyKeywords } from "./keywords";
import { parseStuffAtom } from "./parse-atom";
import { parseHeraldRss } from "./parse-herald";
import { parseNewsroomRss } from "./parse-newsroom";
import { type ParsedArticle, parseRnzRss } from "./parse-rss";
import { scoreArticles } from "./score";

const FEEDS = {
  rnz: "https://www.rnz.co.nz/rss/business.xml",
  stuff: "https://www.stuff.co.nz/rss?section=/business",
  herald: "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml",
  newsroom: "https://newsroom.co.nz/category/economy/feed/",
} as const;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const match = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    );
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
      signal: AbortSignal.timeout(10_000),
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
  console.log("[news] Fetching RSS feeds from 4 sources...");

  const [rnzXml, stuffXml, heraldXml, newsroomXml] = await Promise.all([
    fetchFeed(FEEDS.rnz),
    fetchFeed(FEEDS.stuff),
    fetchFeed(FEEDS.herald),
    fetchFeed(FEEDS.newsroom),
  ]);

  const allArticles: ParsedArticle[] = [];

  if (rnzXml) {
    const items = parseRnzRss(rnzXml);
    console.log(`[news] RNZ: ${items.length} items parsed`);
    allArticles.push(...items.map((a) => ({ ...a, source: "rnz" })));
  }

  if (stuffXml) {
    const items = parseStuffAtom(stuffXml);
    console.log(`[news] Stuff: ${items.length} items parsed`);
    allArticles.push(...items.map((a) => ({ ...a, source: "stuff" })));
  }

  if (heraldXml) {
    const items = parseHeraldRss(heraldXml);
    console.log(`[news] Herald: ${items.length} items parsed`);
    allArticles.push(...items.map((a) => ({ ...a, source: "herald" })));
  }

  if (newsroomXml) {
    const items = parseNewsroomRss(newsroomXml);
    console.log(`[news] Newsroom: ${items.length} items parsed`);
    allArticles.push(...items.map((a) => ({ ...a, source: "newsroom" })));
  }

  // Keyword filter
  const filtered = allArticles.filter((a) =>
    matchesEconomyKeywords(a.title, a.excerpt)
  );
  console.log(
    `[news] ${filtered.length}/${allArticles.length} articles match economy keywords`
  );

  // Score articles
  const scored = scoreArticles(filtered);
  const topScored = scored.sort((a, b) => b.score - a.score).slice(0, 5);
  if (topScored.length > 0) {
    console.log(
      `[news] Top scored: "${topScored[0]!.title}" (score: ${topScored[0]!.score})`
    );
  }

  // Enrich articles without images via og:image fetch
  const toEnrich = filtered.filter((a) => !a.imageUrl);
  if (toEnrich.length > 0) {
    console.log(
      `[news] Fetching og:image for ${toEnrich.length} articles without images...`
    );
    await Promise.all(
      toEnrich.map(async (article) => {
        article.imageUrl = await fetchOgImage(article.url);
      })
    );
    const enriched = toEnrich.filter((a) => a.imageUrl).length;
    console.log(`[news] Got images for ${enriched}/${toEnrich.length} articles`);
  }

  // Insert into articles table
  const rows: NewArticle[] = filtered.map((a) => ({
    url: a.url,
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: a.imageUrl,
    source: a.source ?? "unknown",
    publishedAt: a.publishedAt,
  }));

  await insertArticles(db, rows);
  console.log(`[news] Inserted/updated ${rows.length} articles`);

  return [];
}
```

- [ ] **Step 2: Test collector**

Run: `cd apps/ingestion && bun run src/collect-all.ts --skip=groceries,rbnz,stats-nz,reinz,petrol,electricity,minimum-wage,rent-vs-buy`

Expected: All 4 feeds parse, keyword filter runs, scoring logs the top article, images enriched, articles inserted.

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/src/collectors/news/index.ts
git commit -m "feat(news): expand collector to 4 sources with importance scoring"
```

---

### Task 5: Update DB Query for 4-Source Balanced Mix

**Files:**
- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Update getLatestArticles for 4 sources**

Replace the `getLatestArticles` function in `packages/db/src/queries.ts`:

```typescript
export async function getLatestArticles(db: Db, perSource: number) {
  const sources = ["rnz", "stuff", "herald", "newsroom"];

  const results = await Promise.all(
    sources.map((source) =>
      db
        .select()
        .from(articles)
        .where(eq(articles.source, source))
        .orderBy(desc(articles.publishedAt))
        .limit(perSource)
    )
  );

  return results
    .flat()
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): update getLatestArticles for 4 sources"
```

---

### Task 6: Update Web Query + Scoring for Lead Selection

**Files:**
- Modify: `apps/web/lib/queries.ts`
- Create: `apps/web/lib/score-articles.ts`

- [ ] **Step 1: Create client-side scoring module**

Create `apps/web/lib/score-articles.ts`:

```typescript
/**
 * Score articles for display ordering. The highest-scored article becomes the lead.
 * This mirrors the ingestion scoring logic but runs on the web side
 * against the articles already in the DB.
 */

const TIER_1 = [
  "ocr", "rbnz", "reserve bank", "monetary policy",
  "gdp", "cpi", "recession", "cash rate", "fiscal", "budget",
];
const TIER_2 = [
  "interest rate", "inflation", "mortgage", "house price", "housing",
  "unemployment", "employment", "labour market", "property", "reinz",
  "cost of living", "exchange rate",
];

function getKeywordTierScore(title: string, excerpt: string): number {
  const text = `${title} ${excerpt}`.toLowerCase();
  for (const kw of TIER_1) {
    if (text.includes(kw)) return 30;
  }
  for (const kw of TIER_2) {
    if (text.includes(kw)) return 20;
  }
  return 10;
}

function getRecencyScore(publishedAt: string): number {
  const ageHours =
    (Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60);

  if (ageHours <= 6) return 25;
  if (ageHours <= 12) return 20;
  if (ageHours <= 24) return 15;
  if (ageHours <= 48) return 10;
  return 5;
}

function getCoverageScore(
  title: string,
  allArticles: { title: string; source: string }[]
): number {
  const TOPIC_TERMS = [
    "ocr", "rbnz", "reserve bank", "gdp", "cpi", "recession",
    "interest rate", "inflation", "mortgage", "house price", "housing",
    "unemployment", "petrol", "fuel", "grocery", "exchange rate",
    "budget", "fiscal", "trade", "employment",
  ];
  const text = title.toLowerCase();
  const myTerms = TOPIC_TERMS.filter((t) => text.includes(t));
  if (myTerms.length === 0) return 0;

  const sourcesOnSameTopic = new Set<string>();
  for (const article of allArticles) {
    const otherText = article.title.toLowerCase();
    if (myTerms.some((t) => otherText.includes(t))) {
      sourcesOnSameTopic.add(article.source);
    }
  }
  return (sourcesOnSameTopic.size - 1) * 15;
}

export function pickLeadAndRest<
  T extends { title: string; excerpt: string; publishedAt: string; source: string },
>(articles: T[]): { lead: T; rest: T[] } | null {
  if (articles.length === 0) return null;

  const scored = articles.map((article) => ({
    article,
    score:
      getKeywordTierScore(article.title, article.excerpt) +
      getRecencyScore(article.publishedAt) +
      getCoverageScore(
        article.title,
        articles.map((a) => ({ title: a.title, source: a.source }))
      ),
  }));

  scored.sort((a, b) => b.score - a.score);

  const lead = scored[0]!.article;
  const rest = scored.slice(1).map((s) => s.article);

  return { lead, rest };
}
```

- [ ] **Step 2: Update getNewsData**

In `apps/web/lib/queries.ts`, update the `getNewsData` function:

```typescript
export async function getNewsData() {
  return getLatestArticles(db, 2);
}
```

(This stays the same — 2 per source × 4 sources = up to 8 articles, we'll trim to 7 in the component.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/score-articles.ts apps/web/lib/queries.ts
git commit -m "feat(web): add article importance scoring for lead selection"
```

---

### Task 7: Update NewsSection Component

**Files:**
- Modify: `apps/web/components/sections/news-section.tsx`

- [ ] **Step 1: Update component for 1 lead + 6 cards, 4 source badges**

Replace the contents of `apps/web/components/sections/news-section.tsx`:

```typescript
import Image from "next/image";
import { SectionHeader } from "@workspace/ui/components/section-header";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";
import { pickLeadAndRest } from "@/lib/score-articles";

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  newsroom: { bg: "#1a6b3c", label: "Newsroom" },
};

function SourceBadge({ source }: { source: string }) {
  const config = BADGE_COLORS[source] ?? { bg: "#666", label: source };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-sans font-semibold text-white text-[9px] tracking-wide"
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

export async function NewsSection() {
  const articles = await getNewsData();
  const result = pickLeadAndRest(articles);

  if (!result) {
    return null;
  }

  const { lead, rest } = result;
  const displayRest = rest.slice(0, 6);

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ, Stuff, Herald &amp; Newsroom"
        title="In the News"
      />

      {/* Lead story — horizontal card (image left, text right) */}
      <a
        className="group grid grid-cols-2 overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
        href={lead.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative h-[240px] overflow-hidden">
          {lead.imageUrl ? (
            <Image
              alt={lead.title}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 1200px) 50vw, 576px"
              src={lead.imageUrl}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
              }}
            />
          )}
        </div>
        <div className="flex flex-col justify-center px-7 py-6">
          <div className="mb-2 flex items-center gap-2">
            <SourceBadge source={lead.source} />
            <span className="font-sans text-[11px] text-[#998]">
              {timeAgo(lead.publishedAt)}
            </span>
          </div>
          <h3 className="font-bold font-heading text-[#2a2520] text-xl leading-tight text-balance">
            {lead.title}
          </h3>
          {lead.excerpt && (
            <p className="mt-3 text-[13.5px] text-[#5a5550] leading-[1.7]">
              {lead.excerpt}
            </p>
          )}
        </div>
      </a>

      {/* 6 small image cards — 2 rows of 3 */}
      {displayRest.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {displayRest.map((article) => (
            <a
              className="group/card block overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
              href={article.url}
              key={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="relative h-[120px] w-full overflow-hidden">
                {article.imageUrl ? (
                  <Image
                    alt={article.title}
                    className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
                    fill
                    sizes="(max-width: 1200px) 33vw, 370px"
                    src={article.imageUrl}
                  />
                ) : (
                  <div
                    className="h-full w-full"
                    style={{
                      background:
                        "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
                    }}
                  />
                )}
              </div>
              <div className="px-3 py-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <SourceBadge source={article.source} />
                  <span className="font-sans text-[#998] text-[9px]">
                    {timeAgo(article.publishedAt)}
                  </span>
                </div>
                <h4 className="font-heading font-semibold text-[#2a2520] text-[15px] leading-snug text-balance">
                  {article.title}
                </h4>
              </div>
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
git commit -m "feat(web): update NewsSection for 7 articles with 4 source badges"
```

---

### Task 8: Image Domain Config

**Files:**
- Modify: `apps/web/next.config.mjs`

- [ ] **Step 1: Add Herald and Newsroom image domains**

Update `apps/web/next.config.mjs` remotePatterns to:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui", "@workspace/db"],
  images: {
    remotePatterns: [
      { hostname: "www.rnz.co.nz" },
      { hostname: "media.rnz.co.nz" },
      { hostname: "media.rnztools.nz" },
      { hostname: "www.stuff.co.nz" },
      { hostname: "resources.stuff.co.nz" },
      { hostname: "media.nzherald.co.nz" },
      { hostname: "www.nzherald.co.nz" },
      { hostname: "newsroom.co.nz" },
      { hostname: "www.newsroom.co.nz" },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/next.config.mjs
git commit -m "feat(web): add Herald and Newsroom image domains"
```

---

### Task 9: End-to-End Verification

- [ ] **Step 1: Run lint check on new files**

Run: `bunx biome check --write --unsafe apps/ingestion/src/collectors/news/ apps/web/lib/score-articles.ts apps/web/components/sections/news-section.tsx`

Fix any remaining issues manually if needed.

- [ ] **Step 2: Run the collector**

Run: `cd apps/ingestion && bun run src/collect-all.ts --skip=groceries,rbnz,stats-nz,reinz,petrol,electricity,minimum-wage,rent-vs-buy`

Expected: All 4 feeds parse. Check that Herald and Newsroom articles appear.

- [ ] **Step 3: Verify the dashboard**

Run: `bun run dev:web`

Open http://localhost:3000 and check:
- 7 articles display (1 lead + 6 cards in 2 rows of 3)
- Mix of RNZ, Stuff, Herald, and Newsroom badges visible
- Lead article is the highest-importance story (not just most recent)
- Images load for Herald and Newsroom articles
- All links open in new tabs

- [ ] **Step 4: Check actual image domains in DB**

If any next/image errors appear, check what hostnames are actually used and add them to next.config.mjs.

- [ ] **Step 5: Commit any fixes**

```bash
bun run fix
git add -A
git commit -m "fix: lint and image domain fixes for news expansion"
```

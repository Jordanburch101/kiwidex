# News Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the news feature into a Ground News-inspired story aggregation system with AI-powered clustering, tagging, summaries, and dedicated news/story pages.

**Architecture:** Stories become first-class entities backed by a `stories` table. Haiku handles article tagging and story matching during ingestion. Sonnet generates story summaries and angle analysis. Three frontend surfaces: modified homepage section, `/news` grid page, `/news/[slug]` story detail page.

**Tech Stack:** Drizzle ORM (libSQL), Anthropic SDK (Haiku + Sonnet), Next.js 16 App Router, Recharts (sparklines), existing Biome/Ultracite linting.

**Spec:** `docs/superpowers/specs/2026-04-02-news-expansion-design.md`

---

## File Structure

### New files
```
packages/db/src/schema.ts                          — add stories table + articles columns
packages/db/src/queries.ts                         — add story queries (upsert, get, cleanup)
apps/ingestion/src/collectors/news/ai.ts           — Haiku tagging + story matching
apps/ingestion/src/collectors/news/enrich.ts       — Sonnet story enrichment (summary, angles, metrics)
apps/ingestion/src/collectors/news/slugify.ts      — story ID generation from headlines
apps/web/app/news/page.tsx                         — /news grid page
apps/web/app/news/[slug]/page.tsx                  — /news/[slug] story detail page
apps/web/components/sections/story-card.tsx         — reusable story card (grid + homepage)
apps/web/components/sections/source-card.tsx        — source coverage card (story page)
apps/web/components/sections/filter-pills.tsx       — topic filter pills (client component)
apps/web/components/sections/coverage-sidebar.tsx   — story page sidebar
```

### Modified files
```
packages/db/src/index.ts                           — export new queries + schema
apps/ingestion/src/collectors/news/index.ts        — integrate AI pipeline, expand volume
apps/web/app/page.tsx                              — no changes needed (NewsSection handles itself)
apps/web/components/sections/news-section.tsx       — use stories instead of raw articles
apps/web/lib/queries.ts                            — add story data fetching functions
apps/web/lib/score-articles.ts                     — adapt to score stories for lead selection
```

---

### Task 1: Schema — Add `stories` table and `articles` columns

**Files:**
- Modify: `packages/db/src/schema.ts:97-107`

- [ ] **Step 1: Add the `stories` table to schema**

In `packages/db/src/schema.ts`, add this table definition after the `summaries` table (after line 95):

```typescript
export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(),
  headline: text("headline").notNull(),
  summary: text("summary"),
  tags: text("tags").notNull(),
  angles: text("angles"),
  relatedMetrics: text("related_metrics"),
  sourceCount: integer("source_count").notNull(),
  imageUrl: text("image_url"),
  firstReportedAt: text("first_reported_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 2: Add `tags` and `storyId` columns to existing `articles` table**

In the same file, modify the `articles` table (line 97) to add two new columns before `createdAt`:

```typescript
export const articles = sqliteTable("articles", {
  url: text("url").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  imageUrl: text("image_url"),
  source: text("source").notNull(),
  publishedAt: text("published_at").notNull(),
  tags: text("tags"),
  storyId: text("story_id"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 3: Push schema to local dev DB**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run db:push`

Expected: Schema changes applied, no errors. Existing articles data preserved (new columns are nullable).

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add stories table and tags/storyId columns to articles"
```

---

### Task 2: DB exports — Export new schema and types

**Files:**
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Export the `stories` table from the DB package**

In `packages/db/src/index.ts`, add `stories` to the schema re-exports. Find the line that exports `articles` (around line 36) and add `stories` next to it:

```typescript
export { articles, metrics, products, scraperRuns, stocks, stories, summaries } from "./schema";
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/index.ts
git commit -m "feat(db): export stories table from db package"
```

---

### Task 3: DB queries — Story CRUD and cleanup

**Files:**
- Modify: `packages/db/src/queries.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write tests for story queries**

Create `packages/db/src/__tests__/story-queries.test.ts`:

```typescript
import { describe, expect, it, beforeEach } from "bun:test";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../schema";
import {
  upsertStory,
  getStories,
  getStoryBySlug,
  getArticlesByStoryId,
  updateStoryEnrichment,
  deleteOldArticles,
  deleteOrphanedStories,
  insertArticles,
} from "../queries";

function createTestDb() {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  return db;
}

describe("story queries", () => {
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    db = createTestDb();
    // Create tables via raw SQL for in-memory DB
    await db.run(
      `CREATE TABLE IF NOT EXISTS stories (
        id TEXT PRIMARY KEY,
        headline TEXT NOT NULL,
        summary TEXT,
        tags TEXT NOT NULL,
        angles TEXT,
        related_metrics TEXT,
        source_count INTEGER NOT NULL,
        image_url TEXT,
        first_reported_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
    await db.run(
      `CREATE TABLE IF NOT EXISTS articles (
        url TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        image_url TEXT,
        source TEXT NOT NULL,
        published_at TEXT NOT NULL,
        tags TEXT,
        story_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`
    );
  });

  it("upserts a story", async () => {
    await upsertStory(db, {
      id: "test-story",
      headline: "Test Headline",
      tags: JSON.stringify(["housing"]),
      sourceCount: 2,
      firstReportedAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T12:00:00Z",
    });

    const story = await getStoryBySlug(db, "test-story");
    expect(story).not.toBeNull();
    expect(story!.headline).toBe("Test Headline");
  });

  it("gets stories ordered by updatedAt desc", async () => {
    await upsertStory(db, {
      id: "old-story",
      headline: "Old",
      tags: JSON.stringify(["fuel"]),
      sourceCount: 1,
      firstReportedAt: "2026-03-01T00:00:00Z",
      updatedAt: "2026-03-01T00:00:00Z",
    });
    await upsertStory(db, {
      id: "new-story",
      headline: "New",
      tags: JSON.stringify(["housing"]),
      sourceCount: 2,
      firstReportedAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    });

    const stories = await getStories(db, {});
    expect(stories[0]!.id).toBe("new-story");
  });

  it("filters stories by tag", async () => {
    await upsertStory(db, {
      id: "housing-story",
      headline: "Housing",
      tags: JSON.stringify(["housing"]),
      sourceCount: 1,
      firstReportedAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    });
    await upsertStory(db, {
      id: "fuel-story",
      headline: "Fuel",
      tags: JSON.stringify(["fuel"]),
      sourceCount: 1,
      firstReportedAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    });

    const stories = await getStories(db, { tag: "housing" });
    expect(stories).toHaveLength(1);
    expect(stories[0]!.id).toBe("housing-story");
  });

  it("gets articles by storyId", async () => {
    await insertArticles(db, [
      {
        url: "https://example.com/1",
        title: "Article 1",
        excerpt: "Excerpt",
        source: "rnz",
        publishedAt: "2026-04-01T00:00:00Z",
        storyId: "test-story",
        tags: JSON.stringify(["housing"]),
      },
      {
        url: "https://example.com/2",
        title: "Article 2",
        excerpt: "Excerpt",
        source: "stuff",
        publishedAt: "2026-04-01T00:00:00Z",
        storyId: "other-story",
        tags: null,
      },
    ]);

    const articles = await getArticlesByStoryId(db, "test-story");
    expect(articles).toHaveLength(1);
    expect(articles[0]!.title).toBe("Article 1");
  });

  it("updates story enrichment", async () => {
    await upsertStory(db, {
      id: "test-story",
      headline: "Test",
      tags: JSON.stringify(["housing"]),
      sourceCount: 1,
      firstReportedAt: "2026-04-01T00:00:00Z",
      updatedAt: "2026-04-01T00:00:00Z",
    });

    await updateStoryEnrichment(db, "test-story", {
      summary: "- Bullet one\n- Bullet two",
      angles: JSON.stringify([{ source: "rnz", angle: "Policy", description: "Desc" }]),
      relatedMetrics: JSON.stringify(["ocr", "mortgage_1yr"]),
    });

    const story = await getStoryBySlug(db, "test-story");
    expect(story!.summary).toBe("- Bullet one\n- Bullet two");
    expect(story!.relatedMetrics).toBe(JSON.stringify(["ocr", "mortgage_1yr"]));
  });

  it("deletes old articles and orphaned stories", async () => {
    await upsertStory(db, {
      id: "orphan-story",
      headline: "Orphan",
      tags: JSON.stringify(["fuel"]),
      sourceCount: 1,
      firstReportedAt: "2026-02-01T00:00:00Z",
      updatedAt: "2026-02-01T00:00:00Z",
    });

    await insertArticles(db, [
      {
        url: "https://example.com/old",
        title: "Old Article",
        excerpt: "Old",
        source: "rnz",
        publishedAt: "2026-02-01T00:00:00Z",
        storyId: "orphan-story",
        tags: null,
      },
    ]);

    await deleteOldArticles(db, "2026-03-01");
    const articlesAfter = await getArticlesByStoryId(db, "orphan-story");
    expect(articlesAfter).toHaveLength(0);

    await deleteOrphanedStories(db);
    const story = await getStoryBySlug(db, "orphan-story");
    expect(story).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/db && bun test src/__tests__/story-queries.test.ts`

Expected: FAIL — functions not exported yet.

- [ ] **Step 3: Implement story queries**

In `packages/db/src/queries.ts`, add after the existing article queries (after line 322):

```typescript
// --- Story queries ---

export type NewStory = typeof stories.$inferInsert;

export async function upsertStory(db: Db, story: NewStory) {
  await db
    .insert(stories)
    .values(story)
    .onConflictDoUpdate({
      target: [stories.id],
      set: {
        headline: story.headline,
        tags: story.tags,
        sourceCount: story.sourceCount,
        imageUrl: story.imageUrl,
        firstReportedAt: story.firstReportedAt,
        updatedAt: story.updatedAt,
      },
    });
}

export async function getStories(
  db: Db,
  opts: { days?: number; tag?: string; limit?: number; offset?: number }
) {
  const { days = 30, tag, limit = 50, offset = 0 } = opts;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;

  let query = db
    .select()
    .from(stories)
    .where(gte(stories.updatedAt, cutoff))
    .orderBy(desc(stories.updatedAt))
    .limit(limit)
    .offset(offset);

  const rows = await query;

  if (tag) {
    return rows.filter((row) => {
      const tags: string[] = JSON.parse(row.tags);
      return tags.includes(tag);
    });
  }

  return rows;
}

export async function getStoryBySlug(db: Db, slug: string) {
  const rows = await db
    .select()
    .from(stories)
    .where(eq(stories.id, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getArticlesByStoryId(db: Db, storyId: string) {
  return db
    .select()
    .from(articles)
    .where(eq(articles.storyId, storyId))
    .orderBy(desc(articles.publishedAt));
}

export async function getRecentStories(db: Db, days: number) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString();
  return db
    .select()
    .from(stories)
    .where(gte(stories.updatedAt, cutoff))
    .orderBy(desc(stories.updatedAt));
}

export async function updateStoryEnrichment(
  db: Db,
  storyId: string,
  data: { summary: string; angles: string; relatedMetrics: string }
) {
  await db
    .update(stories)
    .set({
      summary: data.summary,
      angles: data.angles,
      relatedMetrics: data.relatedMetrics,
    })
    .where(eq(stories.id, storyId));
}

export async function deleteOldArticles(db: Db, beforeDate: string) {
  await db
    .delete(articles)
    .where(lte(articles.publishedAt, beforeDate));
}

export async function deleteOrphanedStories(db: Db) {
  // Delete stories that have no articles referencing them
  const allStoryRows = await db.select({ id: stories.id }).from(stories);
  for (const row of allStoryRows) {
    const articleCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(eq(articles.storyId, row.id));
    if (articleCount[0]!.count === 0) {
      await db.delete(stories).where(eq(stories.id, row.id));
    }
  }
}
```

Also add `stories` to the imports at the top of the file (line 6):

```typescript
import {
  articles,
  metrics,
  products,
  scraperRuns,
  stocks,
  stories,
  summaries,
} from "./schema";
```

- [ ] **Step 4: Update `insertArticles` to handle new columns**

Modify the existing `insertArticles` function (around line 258) to include `tags` and `storyId` in the upsert:

```typescript
export async function insertArticles(db: Db, items: NewArticle[]) {
  if (items.length === 0) return;

  const chunkSize = 50;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await db
      .insert(articles)
      .values(chunk)
      .onConflictDoUpdate({
        target: [articles.url],
        set: {
          title: sql`excluded.title`,
          excerpt: sql`excluded.excerpt`,
          imageUrl: sql`excluded.image_url`,
          source: sql`excluded.source`,
          publishedAt: sql`excluded.published_at`,
          tags: sql`excluded.tags`,
          storyId: sql`excluded.story_id`,
          createdAt: sql`datetime('now')`,
        },
      });
  }
}
```

- [ ] **Step 5: Export new queries from DB package**

In `packages/db/src/index.ts`, add all new exports:

```typescript
export {
  deleteOldArticles,
  deleteOrphanedStories,
  getArticlesByStoryId,
  getLatestArticles,
  getRecentStories,
  getStories,
  getStoryBySlug,
  insertArticles,
  updateStoryEnrichment,
  upsertStory,
  type NewArticle,
  type NewStory,
} from "./queries";
```

Make sure `stories` is in the schema exports too (from Step 2).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/db && bun test src/__tests__/story-queries.test.ts`

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/queries.ts packages/db/src/index.ts packages/db/src/__tests__/story-queries.test.ts
git commit -m "feat(db): add story CRUD queries, cleanup functions, and tests"
```

---

### Task 4: Slugify utility

**Files:**
- Create: `apps/ingestion/src/collectors/news/slugify.ts`

- [ ] **Step 1: Write tests**

Create `apps/ingestion/src/collectors/news/__tests__/slugify.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { slugifyHeadline } from "../slugify";

describe("slugifyHeadline", () => {
  it("converts headline to slug with month-year", () => {
    const result = slugifyHeadline("RBNZ Holds OCR at 3.5%", new Date("2026-04-02"));
    expect(result).toBe("rbnz-holds-ocr-at-35-apr-2026");
  });

  it("strips special characters", () => {
    const result = slugifyHeadline("What's Next? A $500M Question", new Date("2026-04-02"));
    expect(result).toBe("whats-next-a-500m-question-apr-2026");
  });

  it("collapses multiple hyphens", () => {
    const result = slugifyHeadline("Petrol --- Prices --- Drop!", new Date("2026-04-02"));
    expect(result).toBe("petrol-prices-drop-apr-2026");
  });

  it("truncates long headlines", () => {
    const longHeadline = "This Is A Very Long Headline That Goes On And On And On And Should Be Truncated At Some Point";
    const result = slugifyHeadline(longHeadline, new Date("2026-04-02"));
    expect(result.length).toBeLessThanOrEqual(80);
    expect(result).toEndWith("-apr-2026");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/ingestion && bun test src/collectors/news/__tests__/slugify.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement slugify**

Create `apps/ingestion/src/collectors/news/slugify.ts`:

```typescript
const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

export function slugifyHeadline(headline: string, date: Date): string {
  const base = headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const month = MONTHS[date.getMonth()]!;
  const year = date.getFullYear();
  const suffix = `-${month}-${year}`;

  // Truncate base to keep total under 80 chars
  const maxBase = 80 - suffix.length;
  const truncated = base.length > maxBase
    ? base.slice(0, base.lastIndexOf("-", maxBase)).replace(/-$/, "")
    : base;

  return `${truncated}${suffix}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/ingestion && bun test src/collectors/news/__tests__/slugify.test.ts`

Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/news/slugify.ts apps/ingestion/src/collectors/news/__tests__/slugify.test.ts
git commit -m "feat(ingestion): add slugify utility for story ID generation"
```

---

### Task 5: AI utilities — Haiku tagging + story matching

**Files:**
- Create: `apps/ingestion/src/collectors/news/ai.ts`

This is the most complex part. The AI module handles two Haiku calls: article tagging and story matching.

- [ ] **Step 1: Create the AI module with tag taxonomy and Haiku client setup**

Create `apps/ingestion/src/collectors/news/ai.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { getRecentStories } from "@workspace/db";

export const TAG_TAXONOMY = [
  "housing",
  "employment",
  "fuel",
  "groceries",
  "currency",
  "markets",
  "interest-rates",
  "inflation",
  "government",
  "trade",
  "general-economy",
] as const;

export type Tag = (typeof TAG_TAXONOMY)[number];

interface ArticleInput {
  title: string;
  excerpt: string;
  source: string;
}

interface TagResult {
  tags: Tag[];
}

interface MatchResult {
  index: number;
  match: string; // "existing:<id>" | "new" | "standalone"
}

interface ClusterGroup {
  articles: number[];
  headline: string | null;
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  return new Anthropic({ apiKey });
}

async function callHaiku(prompt: string): Promise<string> {
  const client = getClient();
  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const block = response.content[0];
  return block?.type === "text" ? block.text : "";
}

function parseJsonFromResponse<T>(text: string): T | null {
  // Extract JSON from possible markdown code blocks
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (!jsonMatch?.[1]) return null;
  try {
    return JSON.parse(jsonMatch[1]) as T;
  } catch {
    return null;
  }
}

// --- Article Tagging ---

export async function tagArticles(articles: ArticleInput[]): Promise<Tag[][]> {
  const articleList = articles
    .map((a, i) => `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}"`)
    .join("\n");

  const prompt = `You are tagging NZ economic news articles. For each article, assign 1-3 tags from this taxonomy:
${TAG_TAXONOMY.join(", ")}

Return ONLY a JSON array where each element is an array of tags for the corresponding article (by index). Example: [["housing", "interest-rates"], ["fuel"], ["employment", "government"]]

Articles:
${articleList}`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<string[][]>(response);

  if (!parsed || parsed.length !== articles.length) {
    // Retry once
    const retryResponse = await callHaiku(prompt);
    const retryParsed = parseJsonFromResponse<string[][]>(retryResponse);

    if (!retryParsed || retryParsed.length !== articles.length) {
      console.warn("[news/ai] Tagging failed after retry, falling back to general-economy");
      return articles.map(() => ["general-economy" as Tag]);
    }
    return sanitizeTags(retryParsed);
  }

  return sanitizeTags(parsed);
}

function sanitizeTags(tagArrays: string[][]): Tag[][] {
  const validTags = new Set<string>(TAG_TAXONOMY);
  return tagArrays.map((tags) =>
    tags.filter((t) => validTags.has(t)) as Tag[]
  ).map((tags) => tags.length > 0 ? tags : ["general-economy" as Tag]);
}

// --- Story Matching ---

type ExistingStory = Awaited<ReturnType<typeof getRecentStories>>[number];

export async function matchArticlesToStories(
  articles: ArticleInput[],
  existingStories: ExistingStory[]
): Promise<{ matches: MatchResult[]; newClusters: ClusterGroup[] }> {
  // Pass 1: Match against existing stories
  const matches = await matchAgainstExisting(articles, existingStories);

  // Pass 2: Cluster "new" articles among themselves
  const newIndices = matches
    .filter((m) => m.match === "new")
    .map((m) => m.index);

  let newClusters: ClusterGroup[] = [];
  if (newIndices.length >= 2) {
    const newArticles = newIndices.map((i) => ({
      ...articles[i - 1]!,
      originalIndex: i,
    }));
    newClusters = await clusterNewArticles(newArticles);
  }

  return { matches, newClusters };
}

async function matchAgainstExisting(
  articles: ArticleInput[],
  existingStories: ExistingStory[]
): Promise<MatchResult[]> {
  if (existingStories.length === 0) {
    // No existing stories — everything is "new"
    return articles.map((_, i) => ({ index: i + 1, match: "new" }));
  }

  const storyList = existingStories
    .map((s) => `{"id": "${s.id}", "headline": "${s.headline}", "tags": ${s.tags}}`)
    .join(",\n  ");

  const articleList = articles
    .map((a, i) => `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}" | Source: ${a.source}`)
    .join("\n");

  const prompt = `You are matching new NZ economic news articles to existing stories. A "story" is a real-world event or development covered by multiple outlets.

Existing stories (may be matched):
[
  ${storyList}
]

New articles to classify:
${articleList}

For each article, respond with:
- "existing:<story_id>" if it belongs to an existing story
- "new" if it's a genuinely new story not covered by any existing one
- "standalone" if it's a one-off article unlikely to get multi-outlet coverage

Rules:
- Only match if the articles are about the SAME specific event or development, not just the same broad topic
- "Housing costs rise" and "REINZ median price up 3%" might be the same story; "Housing costs rise" and "Government announces first-home grant" are NOT
- When uncertain, prefer "new" over forcing a match to an existing story
- An article can only belong to one story

Return ONLY a JSON array: [{"index": 1, "match": "existing:rbnz-ocr-hold-apr-2026"}, {"index": 2, "match": "new"}, ...]`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<MatchResult[]>(response);

  if (!parsed || parsed.length !== articles.length) {
    // Retry once
    const retryResponse = await callHaiku(prompt);
    const retryParsed = parseJsonFromResponse<MatchResult[]>(retryResponse);

    if (!retryParsed || retryParsed.length !== articles.length) {
      console.warn("[news/ai] Story matching failed after retry, treating all as standalone");
      return articles.map((_, i) => ({ index: i + 1, match: "standalone" }));
    }
    return validateMatches(retryParsed, existingStories);
  }

  return validateMatches(parsed, existingStories);
}

function validateMatches(
  matches: MatchResult[],
  existingStories: ExistingStory[]
): MatchResult[] {
  const validIds = new Set(existingStories.map((s) => s.id));
  return matches.map((m) => {
    if (m.match.startsWith("existing:")) {
      const storyId = m.match.replace("existing:", "");
      if (!validIds.has(storyId)) {
        console.warn(`[news/ai] Invalid story ID "${storyId}", treating as new`);
        return { ...m, match: "new" };
      }
    }
    return m;
  });
}

async function clusterNewArticles(
  articles: { title: string; excerpt: string; source: string; originalIndex: number }[]
): Promise<ClusterGroup[]> {
  const articleList = articles
    .map((a, i) => `${i + 1}. Title: "${a.title}" | Excerpt: "${a.excerpt.slice(0, 200)}" | Source: ${a.source}`)
    .join("\n");

  const prompt = `These articles were all marked as new stories. Group any that are about the same event or development.

Articles:
${articleList}

Return ONLY a JSON array of groups:
[{"articles": [1, 2], "headline": "Neutral headline for this story"}, {"articles": [3], "headline": null}]
- Generate a neutral, factual headline for groups of 2+ articles
- Single articles get headline: null (we'll use the article's own title)`;

  const response = await callHaiku(prompt);
  const parsed = parseJsonFromResponse<ClusterGroup[]>(response);

  if (!parsed) {
    // No clustering — each article is standalone
    return articles.map((a) => ({
      articles: [a.originalIndex],
      headline: null,
    }));
  }

  // Map back to original indices
  return parsed.map((group) => ({
    articles: group.articles.map((i) => articles[i - 1]?.originalIndex ?? i),
    headline: group.headline,
  }));
}
```

- [ ] **Step 2: Run lint check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

Expected: No lint errors in new file.

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/src/collectors/news/ai.ts
git commit -m "feat(ingestion): add Haiku-powered article tagging and story matching"
```

---

### Task 6: AI utilities — Sonnet story enrichment

**Files:**
- Create: `apps/ingestion/src/collectors/news/enrich.ts`

- [ ] **Step 1: Create the enrichment module**

Create `apps/ingestion/src/collectors/news/enrich.ts`:

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { METRIC_META, type MetricKey } from "@workspace/db";

interface StoryArticle {
  title: string;
  excerpt: string;
  source: string;
}

interface EnrichmentResult {
  summary: string;
  angles: { source: string; angle: string; description: string }[];
  relatedMetrics: MetricKey[];
}

const VALID_METRICS = new Set(Object.keys(METRIC_META));

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }
  return new Anthropic({ apiKey });
}

export async function enrichStory(
  headline: string,
  articles: StoryArticle[]
): Promise<EnrichmentResult | null> {
  const isMultiSource = articles.length > 1;

  const articleList = articles
    .map((a) => `- [${a.source.toUpperCase()}] "${a.title}" — "${a.excerpt}"`)
    .join("\n");

  const anglesInstruction = isMultiSource
    ? `2. **angles**: For each source, a short label (2-3 words) and one-sentence description of their reporting angle. Categories like "Policy focus", "Consumer impact", "Market analysis", "Human interest", "Data-driven", "Industry perspective".`
    : `2. **angles**: Return an empty array [] (single-source story).`;

  const prompt = `You are analysing a NZ economic news story for The Kiwidex, an NZ economy dashboard.

Story headline: "${headline}"

Source articles:
${articleList}

Generate:
1. **summary**: ${isMultiSource ? "3-6" : "2-3"} bullet points synthesising the story${isMultiSource ? " across all sources" : ""}. Be factual and neutral. Include specific numbers/data points mentioned. Each bullet should be 1-2 sentences. Format as markdown list (- Bullet).

${anglesInstruction}

3. **relatedMetrics**: Which dashboard metrics does this story directly relate to? Pick from: ocr, cpi, gdp_growth, unemployment, wage_growth, median_income, house_price_median, house_price_index, mortgage_floating, mortgage_1yr, mortgage_2yr, nzd_usd, nzd_aud, nzd_eur, petrol_91, petrol_95, petrol_diesel, electricity_wholesale, milk, eggs, bread, butter, cheese, bananas, nzx_50, minimum_wage

Return ONLY valid JSON:
{
  "summary": "- Bullet one\\n- Bullet two",
  "angles": [{"source": "rnz", "angle": "Policy focus", "description": "..."}],
  "relatedMetrics": ["ocr", "mortgage_1yr"]
}`;

  const client = getClient();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0]?.type === "text" ? response.content[0].text : "";

  // Parse JSON from response
  const jsonMatch =
    text.match(/```(?:json)?\s*([\s\S]*?)```/) ??
    text.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    console.warn("[news/enrich] Failed to parse Sonnet response for:", headline);
    return null;
  }

  try {
    const parsed = JSON.parse(jsonMatch[1]) as EnrichmentResult;

    // Validate relatedMetrics
    parsed.relatedMetrics = parsed.relatedMetrics.filter((m) =>
      VALID_METRICS.has(m)
    ) as MetricKey[];

    // Validate angles — only keep sources that have articles
    const validSources = new Set(articles.map((a) => a.source));
    parsed.angles = parsed.angles.filter((a) => validSources.has(a.source));

    return parsed;
  } catch {
    console.warn("[news/enrich] JSON parse error for:", headline);
    return null;
  }
}
```

- [ ] **Step 2: Run lint check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

Expected: No lint errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ingestion/src/collectors/news/enrich.ts
git commit -m "feat(ingestion): add Sonnet-powered story enrichment (summary, angles, metrics)"
```

---

### Task 7: Integrate AI pipeline into news collector

**Files:**
- Modify: `apps/ingestion/src/collectors/news/index.ts`

This is the integration task — wiring the AI modules into the existing collection flow.

- [ ] **Step 1: Refactor the news collector to use the AI pipeline**

Replace the content of `apps/ingestion/src/collectors/news/index.ts` with the expanded pipeline. Keep all existing imports and add new ones. The key changes:

1. After scoring, call `tagArticles()` to get tags
2. Call `matchArticlesToStories()` to assign articles to stories
3. Upsert stories, then upsert articles with storyId + tags
4. Call `enrichStory()` for new/updated stories
5. Run cleanup (delete old articles, orphaned stories)

The full rewrite of this file is complex — read the existing file carefully and integrate. The critical additions are:

Add imports at the top:
```typescript
import {
  deleteOldArticles,
  deleteOrphanedStories,
  getArticlesByStoryId,
  getRecentStories,
  insertArticles,
  type NewArticle,
  updateStoryEnrichment,
  upsertStory,
} from "@workspace/db";
import { tagArticles, matchArticlesToStories } from "./ai";
import { enrichStory } from "./enrich";
import { slugifyHeadline } from "./slugify";
```

After the existing scoring step (around line 136), add the AI pipeline:

```typescript
  // --- AI Enrichment Pipeline ---

  // 1. Tag articles with Haiku
  let articleTags: string[][] = [];
  try {
    articleTags = await tagArticles(
      scored.map((a) => ({ title: a.title, excerpt: a.excerpt, source: a.source }))
    );
    console.log(`[news] Tagged ${articleTags.length} articles`);
  } catch (error) {
    console.warn("[news] Tagging failed, proceeding without tags:", error);
    articleTags = scored.map(() => ["general-economy"]);
  }

  // 2. Match articles to stories with Haiku
  let storyAssignments: Map<number, string> = new Map(); // index -> storyId
  try {
    const existingStories = await getRecentStories(db, 3);
    const { matches, newClusters } = await matchArticlesToStories(
      scored.map((a) => ({ title: a.title, excerpt: a.excerpt, source: a.source })),
      existingStories
    );

    const updatedStoryIds = new Set<string>();

    // Process existing matches
    for (const match of matches) {
      if (match.match.startsWith("existing:")) {
        const storyId = match.match.replace("existing:", "");
        storyAssignments.set(match.index - 1, storyId);
        updatedStoryIds.add(storyId);
      }
    }

    // Process new clusters
    for (const cluster of newClusters) {
      if (cluster.articles.length >= 2 && cluster.headline) {
        const storyId = slugifyHeadline(cluster.headline, new Date());
        const clusterArticles = cluster.articles.map((i) => scored[i - 1]!);
        const clusterTags = new Set<string>();
        for (const idx of cluster.articles) {
          for (const tag of articleTags[idx - 1] ?? []) {
            clusterTags.add(tag);
          }
        }

        const sortedByDate = [...clusterArticles].sort(
          (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
        );
        const leadArticle = clusterArticles.reduce(
          (best, a) => (a.imageUrl ? a : best),
          clusterArticles[0]!
        );

        await upsertStory(db, {
          id: storyId,
          headline: cluster.headline,
          tags: JSON.stringify([...clusterTags]),
          sourceCount: new Set(clusterArticles.map((a) => a.source)).size,
          imageUrl: leadArticle.imageUrl ?? null,
          firstReportedAt: sortedByDate[0]!.publishedAt,
          updatedAt: sortedByDate.at(-1)!.publishedAt,
        });

        for (const idx of cluster.articles) {
          storyAssignments.set(idx - 1, storyId);
        }
        updatedStoryIds.add(storyId);
      }
    }

    // Process standalone "new" articles (single-article stories)
    for (const match of matches) {
      if (match.match === "new" && !storyAssignments.has(match.index - 1)) {
        const article = scored[match.index - 1]!;
        const storyId = slugifyHeadline(article.title, new Date());
        const tags = articleTags[match.index - 1] ?? ["general-economy"];

        await upsertStory(db, {
          id: storyId,
          headline: article.title,
          tags: JSON.stringify(tags),
          sourceCount: 1,
          imageUrl: article.imageUrl ?? null,
          firstReportedAt: article.publishedAt,
          updatedAt: article.publishedAt,
        });
        storyAssignments.set(match.index - 1, storyId);
        updatedStoryIds.add(storyId);
      }
    }

    // Update sourceCount for existing stories that gained new articles
    for (const storyId of updatedStoryIds) {
      const storyArticles = await getArticlesByStoryId(db, storyId);
      const allSources = new Set(storyArticles.map((a) => a.source));
      // Include new articles not yet in DB
      for (const [idx, sid] of storyAssignments) {
        if (sid === storyId) {
          allSources.add(scored[idx]!.source);
        }
      }
      await upsertStory(db, {
        id: storyId,
        headline: (await getRecentStories(db, 3)).find((s) => s.id === storyId)?.headline ?? storyId,
        tags: (await getRecentStories(db, 3)).find((s) => s.id === storyId)?.tags ?? "[]",
        sourceCount: allSources.size,
        firstReportedAt: (await getRecentStories(db, 3)).find((s) => s.id === storyId)?.firstReportedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    console.log(`[news] Matched articles to ${updatedStoryIds.size} stories`);

    // 3. Enrich new/updated stories with Sonnet
    for (const storyId of updatedStoryIds) {
      try {
        const storyArticles = await getArticlesByStoryId(db, storyId);
        // Merge DB articles with new articles not yet inserted
        const allArticles = [
          ...storyArticles.map((a) => ({ title: a.title, excerpt: a.excerpt, source: a.source })),
          ...Array.from(storyAssignments.entries())
            .filter(([, sid]) => sid === storyId)
            .map(([idx]) => scored[idx]!)
            .filter((a) => !storyArticles.some((sa) => sa.url === a.url))
            .map((a) => ({ title: a.title, excerpt: a.excerpt, source: a.source })),
        ];

        const story = (await getRecentStories(db, 3)).find((s) => s.id === storyId);
        if (!story) continue;

        const enrichment = await enrichStory(story.headline, allArticles);
        if (enrichment) {
          await updateStoryEnrichment(db, storyId, {
            summary: enrichment.summary,
            angles: JSON.stringify(enrichment.angles),
            relatedMetrics: JSON.stringify(enrichment.relatedMetrics),
          });
          console.log(`[news] Enriched story: ${storyId}`);
        }
      } catch (error) {
        console.warn(`[news] Enrichment failed for ${storyId}:`, error);
      }
    }
  } catch (error) {
    console.warn("[news] Story matching failed, proceeding without stories:", error);
  }
```

Update the article insertion to include tags and storyId:

```typescript
  // Build articles with tags and storyId
  const articlesToInsert: NewArticle[] = scored.map((article, i) => ({
    url: article.url,
    title: article.title,
    excerpt: article.excerpt,
    imageUrl: article.imageUrl ?? null,
    source: article.source,
    publishedAt: article.publishedAt,
    tags: JSON.stringify(articleTags[i] ?? ["general-economy"]),
    storyId: storyAssignments.get(i) ?? null,
  }));

  await insertArticles(db, articlesToInsert);
```

Add cleanup at the end of the function:

```typescript
  // Cleanup: delete articles older than 30 days and orphaned stories
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]!;
  await deleteOldArticles(db, thirtyDaysAgo);
  await deleteOrphanedStories(db);
```

Also increase the article cap from 5 to 15-20 (find where `scored` is sliced and increase).

- [ ] **Step 2: Run lint check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

Fix any lint issues.

- [ ] **Step 3: Test locally with `bun run collect`**

Run: `cd apps/ingestion && ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY bun run collect -- --source news`

Expected: News collector runs, tags articles, creates stories, enriches them. Check console output for `[news] Tagged`, `[news] Matched`, `[news] Enriched` logs.

- [ ] **Step 4: Verify DB state**

Run: `bun run db:studio`

Check:
- `stories` table has rows with headlines, tags, summaries
- `articles` table has `tags` and `story_id` populated

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/news/index.ts
git commit -m "feat(ingestion): integrate AI pipeline into news collector"
```

---

### Task 8: Frontend queries — Story data fetching

**Files:**
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Add story data fetching functions**

In `apps/web/lib/queries.ts`, add imports and new query functions. Add to imports at top:

```typescript
import {
  getArticlesByStoryId,
  getStories,
  getStoryBySlug,
  // ... existing imports
} from "@workspace/db";
```

Add new query functions before the cached exports section:

```typescript
async function _getNewsPageData() {
  const stories = await getStories(db, { days: 30, limit: 50 });
  if (stories.length === 0) return null;

  // Lead story is the first (most recently updated)
  const lead = stories[0]!;
  const rest = stories.slice(1);

  return { lead, rest };
}

async function _getStoryPageData(slug: string) {
  const story = await getStoryBySlug(db, slug);
  if (!story) return null;

  const articles = await getArticlesByStoryId(db, story.id);

  // Fetch related metrics if available
  let relatedMetricData: {
    metric: string;
    label: string;
    value: string;
    change: string;
    changeType: string;
    sparklineData: number[];
  }[] = [];

  if (story.relatedMetrics) {
    const metricKeys: MetricKey[] = JSON.parse(story.relatedMetrics);
    const from = getOneYearAgo();
    const to = getToday();

    relatedMetricData = await Promise.all(
      metricKeys.slice(0, 5).map(async (metric) => {
        const [latest, series] = await Promise.all([
          getLatestValue(db, metric),
          getTimeSeries(db, metric, from, to),
        ]);
        const values = toValues(series);
        const chartPoints = toChartPoints(series);
        const change =
          chartPoints.length >= 2
            ? computeChange(chartPoints, getPeriodDays(metric))
            : { label: "\u2014", type: "neutral" as const };

        return {
          metric,
          label: METRIC_META[metric].label,
          value:
            latest?.value === undefined || latest?.value === null
              ? "\u2014"
              : formatValue(metric, latest.value),
          change: change.label,
          changeType: change.type,
          sparklineData: values,
        };
      })
    );
  }

  return { story, articles, relatedMetrics: relatedMetricData };
}
```

Add cached exports:

```typescript
export const getNewsPageData = unstable_cache(
  _getNewsPageData,
  ["news-page"],
  CACHE_OPTS
);

export function getStoryPageData(slug: string) {
  return unstable_cache(
    () => _getStoryPageData(slug),
    [`story-${slug}`],
    CACHE_OPTS
  )();
}
```

- [ ] **Step 2: Update existing `_getNewsData` for homepage**

The homepage `_getNewsData` should now return stories instead of raw articles:

```typescript
async function _getNewsData() {
  const stories = await getStories(db, { days: 7, limit: 7 });
  if (stories.length === 0) return null;

  return {
    lead: stories[0]!,
    rest: stories.slice(1),
  };
}
```

- [ ] **Step 3: Run lint check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries.ts
git commit -m "feat(web): add story data fetching for news page and story pages"
```

---

### Task 9: Homepage news section — Use stories

**Files:**
- Modify: `apps/web/components/sections/news-section.tsx`

- [ ] **Step 1: Update the news section to render stories instead of articles**

Replace the content of `apps/web/components/sections/news-section.tsx`:

```typescript
import { SectionHeader } from "@workspace/ui/components/section-header";
import Image from "next/image";
import Link from "next/link";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  "1news": { bg: "#00274e", label: "1News" },
};

function SourceBadge({ source }: { source: string }) {
  const config = BADGE_COLORS[source] ?? { bg: "#666", label: source };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-sans font-semibold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="rounded bg-[#e8e3d9] px-2 py-0.5 font-sans text-[10px] text-[#555]">
      {tag}
    </span>
  );
}

function OutletCount({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="rounded bg-[#2a2520] px-2 py-0.5 font-sans font-semibold text-[10px] text-white">
      {count} outlets
    </span>
  );
}

export async function NewsSection() {
  const result = await getNewsData();

  if (!result) {
    return null;
  }

  const { lead, rest } = result;
  const displayRest = rest.slice(0, 6);
  const leadTags: string[] = JSON.parse(lead.tags);

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ, Stuff, Herald &amp; 1News"
        title="In the News"
      />

      {/* Lead story — horizontal card */}
      <Link
        className="group grid grid-cols-1 overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf] sm:grid-cols-2"
        href={`/news/${lead.id}`}
      >
        <div className="relative h-[200px] overflow-hidden sm:h-[240px]">
          {lead.imageUrl ? (
            <Image
              alt={lead.headline}
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
            <OutletCount count={lead.sourceCount} />
            {leadTags.slice(0, 2).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            <span className="font-sans text-[#998] text-[11px]">
              {timeAgo(lead.updatedAt)}
            </span>
          </div>
          <h3 className="text-balance font-bold font-heading text-[#2a2520] text-xl leading-tight">
            {lead.headline}
          </h3>
        </div>
      </Link>

      {/* Story grid */}
      {displayRest.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayRest.map((story) => {
            const tags: string[] = JSON.parse(story.tags);
            return (
              <Link
                className="group/card block overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
                href={`/news/${story.id}`}
                key={story.id}
              >
                <div className="relative h-[120px] w-full overflow-hidden">
                  {story.imageUrl ? (
                    <Image
                      alt={story.headline}
                      className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
                      fill
                      sizes="(max-width: 1200px) 33vw, 370px"
                      src={story.imageUrl}
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
                    <OutletCount count={story.sourceCount} />
                    {tags.slice(0, 1).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    <span className="font-sans text-[#998] text-[9px]">
                      {timeAgo(story.updatedAt)}
                    </span>
                  </div>
                  <h4 className="text-balance font-heading font-semibold text-[#2a2520] text-[15px] leading-snug">
                    {story.headline}
                  </h4>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* View all link */}
      <div className="mt-4 text-center">
        <Link
          className="border-[#d5d0c5] border-b font-sans text-[#555] text-[13px] no-underline transition-colors hover:border-[#2a2520] hover:text-[#2a2520]"
          href="/news"
        >
          View all stories →
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run lint + build check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

- [ ] **Step 3: Verify visually**

Run: `bun run dev:web`

Then: `cmux browser open http://localhost:3000` and `cmux browser snapshot`

Expected: News section renders with story headlines, outlet count badges, topic tags, and "View all stories →" link. Cards link to `/news/[slug]`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/sections/news-section.tsx
git commit -m "feat(web): update homepage news section to use stories"
```

---

### Task 10: `/news` page — Filterable story grid

**Files:**
- Create: `apps/web/app/news/page.tsx`
- Create: `apps/web/components/sections/filter-pills.tsx`

- [ ] **Step 1: Create the filter pills client component**

Create `apps/web/components/sections/filter-pills.tsx`:

```typescript
"use client";

import { useState } from "react";

const TAGS = [
  "All",
  "Housing",
  "Employment",
  "Fuel",
  "Groceries",
  "Markets",
  "Interest Rates",
  "Inflation",
  "Currency",
  "Trade",
];

const TAG_MAP: Record<string, string> = {
  "All": "all",
  "Housing": "housing",
  "Employment": "employment",
  "Fuel": "fuel",
  "Groceries": "groceries",
  "Markets": "markets",
  "Interest Rates": "interest-rates",
  "Inflation": "inflation",
  "Currency": "currency",
  "Trade": "trade",
};

export function FilterPills({
  onFilterChange,
}: {
  onFilterChange: (tag: string) => void;
}) {
  const [active, setActive] = useState("All");

  return (
    <div className="flex flex-wrap gap-2 border-[#e5e0d5] border-b px-6 py-4">
      {TAGS.map((tag) => (
        <button
          className={`rounded-full px-3.5 py-1 font-sans text-[12px] font-medium transition-colors ${
            active === tag
              ? "bg-[#2a2520] text-white"
              : "border border-[#d5d0c5] text-[#555] hover:bg-[#f0ecdf]"
          }`}
          key={tag}
          onClick={() => {
            setActive(tag);
            onFilterChange(TAG_MAP[tag]!);
          }}
          type="button"
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the `/news` page**

Create `apps/web/app/news/page.tsx`:

```typescript
import type { Metadata } from "next";
import { NewsPageContent } from "@/components/sections/news-page-content";
import { getNewsPageData } from "@/lib/queries";

export const metadata: Metadata = {
  title: "In the News — The Kiwidex",
  description:
    "NZ economy reporting from RNZ, Stuff, Herald & 1News — grouped by story",
};

export default async function NewsPage() {
  const data = await getNewsPageData();

  if (!data) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[#998]">No stories available yet.</p>
      </div>
    );
  }

  return <NewsPageContent stories={[data.lead, ...data.rest]} />;
}
```

- [ ] **Step 3: Create the news page content client component**

Create `apps/web/components/sections/news-page-content.tsx`:

```typescript
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SectionHeader } from "@workspace/ui/components/section-header";
import { FilterPills } from "@/components/sections/filter-pills";
import { timeAgo } from "@/lib/data";

interface Story {
  id: string;
  headline: string;
  tags: string;
  sourceCount: number;
  imageUrl: string | null;
  updatedAt: string;
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="rounded bg-[#e8e3d9] px-2 py-0.5 font-sans text-[10px] text-[#555]">
      {tag}
    </span>
  );
}

function OutletCount({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="rounded bg-[#2a2520] px-2 py-0.5 font-sans font-semibold text-[10px] text-white">
      {count} outlets
    </span>
  );
}

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  "1news": { bg: "#00274e", label: "1News" },
};

function SourceBadge({ source }: { source: string }) {
  const config = BADGE_COLORS[source] ?? { bg: "#666", label: source };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-sans font-semibold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

export function NewsPageContent({ stories }: { stories: Story[] }) {
  const [activeFilter, setActiveFilter] = useState("all");

  const filtered =
    activeFilter === "all"
      ? stories
      : stories.filter((s) => {
          const tags: string[] = JSON.parse(s.tags);
          return tags.includes(activeFilter);
        });

  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      <div className="px-6 pt-8">
        <SectionHeader
          subtitle="NZ economy reporting from RNZ, Stuff, Herald &amp; 1News — grouped by story"
          title="In the News"
        />
      </div>

      <FilterPills onFilterChange={setActiveFilter} />

      {!lead ? (
        <div className="px-6 py-20 text-center">
          <p className="text-[#998]">No stories match this filter.</p>
        </div>
      ) : (
        <>
          {/* Lead story */}
          <Link
            className="group mx-6 mt-6 grid grid-cols-1 overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf] sm:grid-cols-2"
            href={`/news/${lead.id}`}
          >
            <div className="relative h-[200px] overflow-hidden sm:h-[260px]">
              {lead.imageUrl ? (
                <Image
                  alt={lead.headline}
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
                <OutletCount count={lead.sourceCount} />
                {(JSON.parse(lead.tags) as string[]).slice(0, 2).map((tag) => (
                  <TagPill key={tag} tag={tag} />
                ))}
                <span className="font-sans text-[#998] text-[11px]">
                  {timeAgo(lead.updatedAt)}
                </span>
              </div>
              <h3 className="text-balance font-bold font-heading text-[#2a2520] text-xl leading-tight">
                {lead.headline}
              </h3>
            </div>
          </Link>

          {/* Story grid */}
          {rest.length > 0 && (
            <div className="mx-6 mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((story) => {
                const tags: string[] = JSON.parse(story.tags);
                return (
                  <Link
                    className="group/card block overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
                    href={`/news/${story.id}`}
                    key={story.id}
                  >
                    {story.imageUrl ? (
                      <div className="relative h-[120px] w-full overflow-hidden">
                        <Image
                          alt={story.headline}
                          className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
                          fill
                          sizes="(max-width: 1200px) 33vw, 370px"
                          src={story.imageUrl}
                        />
                      </div>
                    ) : null}
                    <div className="px-3 py-3">
                      <div className="mb-1 flex items-center gap-1.5">
                        <OutletCount count={story.sourceCount} />
                        {tags.slice(0, 1).map((tag) => (
                          <TagPill key={tag} tag={tag} />
                        ))}
                        <span className="font-sans text-[#998] text-[9px]">
                          {timeAgo(story.updatedAt)}
                        </span>
                      </div>
                      <h4 className="text-balance font-heading font-semibold text-[#2a2520] text-[15px] leading-snug">
                        {story.headline}
                      </h4>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="py-8" />
    </>
  );
}
```

- [ ] **Step 4: Add layout for news pages**

Create `apps/web/app/news/layout.tsx`:

```typescript
import { Masthead } from "@/components/sections/masthead";
import { Footer } from "@/components/sections/footer";

export default function NewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f4f2ed]">
      <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
        <div className="px-6 py-6">
          <Masthead />
        </div>
        <main>{children}</main>
        <Footer />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run lint + dev server**

Run: `bun run check && bun run dev:web`

Then: `cmux browser open http://localhost:3000/news` and `cmux browser snapshot`

Expected: News page renders with filter pills, lead story card, and 3-column grid.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/news/ apps/web/components/sections/filter-pills.tsx apps/web/components/sections/news-page-content.tsx
git commit -m "feat(web): add /news page with filterable story grid"
```

---

### Task 11: `/news/[slug]` story detail page

**Files:**
- Create: `apps/web/app/news/[slug]/page.tsx`

- [ ] **Step 1: Create the story detail page**

Create `apps/web/app/news/[slug]/page.tsx`:

```typescript
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sparkline } from "@workspace/ui/components/sparkline";
import { timeAgo } from "@/lib/data";
import { getStoryPageData } from "@/lib/queries";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoryPageData(slug);
  if (!data) return { title: "Story Not Found — The Kiwidex" };

  return {
    title: `${data.story.headline} — The Kiwidex`,
    description: data.story.summary?.slice(0, 200) ?? data.story.headline,
    openGraph: {
      title: data.story.headline,
      description: data.story.summary?.slice(0, 200) ?? data.story.headline,
      images: data.story.imageUrl ? [data.story.imageUrl] : [],
    },
  };
}

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  "1news": { bg: "#00274e", label: "1News" },
};

const ANGLE_STYLES: Record<string, string> = {
  "Policy focus": "bg-[#ede9fe] text-[#6d28d9]",
  "Consumer impact": "bg-[#fef3c7] text-[#92400e]",
  "Market analysis": "bg-[#e0f2fe] text-[#0369a1]",
  "Human interest": "bg-[#fce7f3] text-[#9d174d]",
  "Data-driven": "bg-[#ecfdf5] text-[#065f46]",
  "Industry perspective": "bg-[#f5f3ff] text-[#5b21b6]",
};

function SourceBadge({ source }: { source: string }) {
  const config = BADGE_COLORS[source] ?? { bg: "#666", label: source };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-sans font-semibold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

export default async function StoryPage({ params }: Props) {
  const { slug } = await params;
  const data = await getStoryPageData(slug);

  if (!data) {
    notFound();
  }

  const { story, articles, relatedMetrics } = data;
  const tags: string[] = JSON.parse(story.tags);
  const angles: { source: string; angle: string; description: string }[] =
    story.angles ? JSON.parse(story.angles) : [];

  return (
    <>
      {/* Breadcrumb */}
      <div className="border-[#e5e0d5] border-b px-6 py-4 font-sans text-[12px] text-[#998]">
        <Link
          className="border-[#d5d0c5] border-b text-[#555] no-underline hover:border-[#555]"
          href="/news"
        >
          News
        </Link>
        <span className="mx-2 text-[#ccc]">/</span>
        <span>{story.headline.slice(0, 50)}{story.headline.length > 50 ? "..." : ""}</span>
      </div>

      {/* Hero image */}
      {story.imageUrl && (
        <div className="relative h-[340px] w-full overflow-hidden">
          <Image
            alt={story.headline}
            className="object-cover"
            fill
            priority
            sizes="1200px"
            src={story.imageUrl}
          />
        </div>
      )}

      {/* Story header */}
      <div className="border-[#e5e0d5] border-b px-6 py-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {story.sourceCount > 1 && (
            <span className="rounded bg-[#2a2520] px-2.5 py-1 font-sans font-semibold text-[10px] text-white">
              {story.sourceCount} outlets
            </span>
          )}
          {tags.map((tag) => (
            <span
              className="rounded bg-[#e8e3d9] px-2.5 py-1 font-sans text-[10px] text-[#555]"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
        <h2 className="max-w-[700px] font-bold font-heading text-[#2a2520] text-[32px] leading-[1.25]">
          {story.headline}
        </h2>
        <div className="mt-2.5 flex gap-2 font-sans text-[12px] text-[#998]">
          <span>First reported {timeAgo(story.firstReportedAt)}</span>
          <span>·</span>
          <span>Updated {timeAgo(story.updatedAt)}</span>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="border-[#e5e0d5] px-6 py-7 lg:border-r lg:pr-8">
          {/* AI Summary */}
          {story.summary && (
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2 border-[#e5e0d5] border-b pb-2.5">
                <span className="font-semibold text-[#998] text-[10px] uppercase tracking-[0.2em]">
                  Story Summary
                </span>
                <span className="rounded bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1.5 py-0.5 font-semibold text-[9px] text-white tracking-wide">
                  AI
                </span>
              </div>
              <div className="prose prose-sm max-w-none text-[14.5px] leading-[1.7] text-[#333]">
                {story.summary.split("\n").map((line, i) => {
                  const bullet = line.replace(/^-\s*/, "").trim();
                  if (!bullet) return null;
                  return (
                    <p className="mb-2 border-[#f0ecdf] border-b pb-2 pl-5 last:border-0" key={i}>
                      <span className="absolute -ml-5 font-bold text-[#998]">•</span>
                      {bullet}
                    </p>
                  );
                })}
              </div>
              <p className="mt-3 font-sans text-[10px] text-[#bbb] italic">
                Summary generated by AI from source articles. May contain inaccuracies.
              </p>
            </div>
          )}

          {/* Source Coverage */}
          <div>
            <div className="mb-4 border-[#e5e0d5] border-b pb-2.5">
              <span className="font-semibold text-[#998] text-[10px] uppercase tracking-[0.2em]">
                Source Coverage
              </span>
            </div>
            <div className="space-y-3">
              {articles.map((article) => {
                const articleAngle = angles.find(
                  (a) => a.source === article.source
                );
                return (
                  <a
                    className="group/src grid grid-cols-1 overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#f8f6f0] sm:grid-cols-[180px_1fr]"
                    href={article.url}
                    key={article.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {article.imageUrl && (
                      <div className="relative h-[120px] overflow-hidden sm:h-full">
                        <Image
                          alt={article.title}
                          className="object-cover"
                          fill
                          sizes="180px"
                          src={article.imageUrl}
                        />
                      </div>
                    )}
                    <div className="flex flex-col p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <SourceBadge source={article.source} />
                        <span className="font-sans font-semibold text-[#2a2520] text-[13px]">
                          {BADGE_COLORS[article.source]?.label ?? article.source}
                        </span>
                        {articleAngle && (
                          <span
                            className={`rounded px-2 py-0.5 font-sans text-[10px] font-medium ${
                              ANGLE_STYLES[articleAngle.angle] ??
                              "bg-[#f3f4f6] text-[#6b7280]"
                            }`}
                          >
                            {articleAngle.angle}
                          </span>
                        )}
                        <span className="ml-auto font-sans text-[10px] text-[#998]">
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>
                      <h4 className="mb-1 font-heading font-bold text-[#2a2520] text-[16px] leading-snug">
                        {article.title}
                      </h4>
                      <p className="flex-1 font-sans text-[12.5px] text-[#666] leading-[1.55]">
                        {article.excerpt}
                      </p>
                      <span className="mt-2.5 font-sans text-[12px] text-[#998]">
                        Read on {BADGE_COLORS[article.source]?.label ?? article.source} →
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="px-6 py-7">
          {/* Coverage Details */}
          <div className="mb-6 rounded-lg border border-[#e5e0d5] p-5">
            <h3 className="mb-4 border-[#e5e0d5] border-b pb-2.5 font-semibold text-[#998] text-[11px] uppercase tracking-[0.15em]">
              Coverage Details
            </h3>
            <div className="space-y-1.5">
              <div className="flex justify-between py-1.5 font-sans text-[13px]">
                <span className="text-[#555]">Sources</span>
                <span className="font-bold text-[#2a2520]">{story.sourceCount}</span>
              </div>
              <div className="flex justify-between py-1.5 font-sans text-[13px]">
                <span className="text-[#555]">First Reported</span>
                <span className="font-bold text-[#2a2520]">{timeAgo(story.firstReportedAt)}</span>
              </div>
              <div className="flex justify-between py-1.5 font-sans text-[13px]">
                <span className="text-[#555]">Last Updated</span>
                <span className="font-bold text-[#2a2520]">{timeAgo(story.updatedAt)}</span>
              </div>
            </div>
            <div className="mt-3 flex gap-1.5">
              {articles.map((a) => (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-md font-sans font-extrabold text-[8px] text-white"
                  key={a.url}
                  style={{ backgroundColor: BADGE_COLORS[a.source]?.bg ?? "#666" }}
                >
                  {BADGE_COLORS[a.source]?.label ?? a.source}
                </div>
              ))}
            </div>
          </div>

          {/* How Sources Report It (multi-source only) */}
          {angles.length > 1 && (
            <div className="mb-6 rounded-lg border border-[#e5e0d5] p-5">
              <h3 className="mb-4 flex items-center gap-2 border-[#e5e0d5] border-b pb-2.5 font-semibold text-[#998] text-[11px] uppercase tracking-[0.15em]">
                How Sources Report It
                <span className="rounded bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-1.5 py-0.5 font-semibold text-[9px] text-white">
                  AI
                </span>
              </h3>
              <div className="space-y-3">
                {angles.map((angle) => (
                  <div className="border-[#f5f2ec] border-b pb-3 last:border-0" key={angle.source}>
                    <div className="mb-1.5 flex items-center gap-2">
                      <SourceBadge source={angle.source} />
                      <span
                        className={`rounded px-2 py-0.5 font-sans text-[10px] font-medium ${
                          ANGLE_STYLES[angle.angle] ?? "bg-[#f3f4f6] text-[#6b7280]"
                        }`}
                      >
                        {angle.angle}
                      </span>
                    </div>
                    <p className="font-sans text-[12px] text-[#666] leading-[1.5]">
                      {angle.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Metrics */}
          {relatedMetrics.length > 0 && (
            <div className="rounded-lg border border-[#e5e0d5] p-5">
              <h3 className="mb-4 border-[#e5e0d5] border-b pb-2.5 font-semibold text-[#998] text-[11px] uppercase tracking-[0.15em]">
                Related Metrics
              </h3>
              <div className="space-y-1">
                {relatedMetrics.map((metric) => (
                  <div
                    className="flex items-center justify-between border-[#f5f2ec] border-b py-2.5 last:border-0"
                    key={metric.metric}
                  >
                    <div>
                      <div className="font-sans text-[13px] text-[#555]">
                        {metric.label}
                      </div>
                      {metric.sparklineData.length > 0 && (
                        <div className="mt-1 h-6 w-24 opacity-50">
                          <Sparkline
                            color="#998"
                            data={metric.sparklineData.slice(-30)}
                          />
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-sans font-bold text-[#2a2520] text-[14px]">
                        {metric.value}
                      </span>
                      <span
                        className={`ml-1.5 rounded px-1.5 py-0.5 font-sans font-semibold text-[11px] ${
                          metric.changeType === "up"
                            ? "bg-[#dcfce7] text-[#166534]"
                            : metric.changeType === "down"
                              ? "bg-[#fee2e2] text-[#991b1b]"
                              : "bg-[#f3f4f6] text-[#6b7280]"
                        }`}
                      >
                        {metric.change}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run lint + build check**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run check`

- [ ] **Step 3: Verify visually**

Run: `bun run dev:web`

Then: `cmux browser open http://localhost:3000/news` → click a story → verify the story detail page renders with hero image, AI summary, source coverage cards with images, sidebar with coverage details + angles + related metrics.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/news/[slug]/page.tsx
git commit -m "feat(web): add /news/[slug] story detail page with AI summary and sidebar"
```

---

### Task 12: Final integration and cleanup

**Files:**
- Various files for final polish

- [ ] **Step 1: Add nav links to masthead**

Modify `apps/web/components/sections/masthead.tsx` to add Dashboard/News nav links in the meta row:

```typescript
import Link from "next/link";

// In the meta div, after the date span:
<Link
  className="border-transparent border-b text-[#998] text-xs no-underline transition-colors hover:border-[#998]"
  href="/"
>
  Dashboard
</Link>
<Link
  className="border-transparent border-b text-[#998] text-xs no-underline transition-colors hover:border-[#998]"
  href="/news"
>
  News
</Link>
```

- [ ] **Step 2: Run the full build**

Run: `cd /Users/jordanburch/Documents/work-files/--mythic--/nz-ecom && bun run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run all tests**

Run: `cd packages/db && bun test`

Expected: All tests pass.

- [ ] **Step 4: Run lint**

Run: `bun run check`

Expected: No lint errors.

- [ ] **Step 5: Push schema to DB**

Run: `bun run db:push`

Expected: Schema updated with new `stories` table and `articles` columns.

- [ ] **Step 6: Run a test collection**

Run: `cd apps/ingestion && bun run collect -- --source news`

Expected: News collector runs with AI pipeline, creates stories, enriches them.

- [ ] **Step 7: Verify the full flow end-to-end**

Run: `bun run dev:web`

1. `cmux browser open http://localhost:3000` — verify homepage news section shows stories with tags and outlet counts
2. Click "View all stories →" — verify `/news` page with grid and filter pills
3. Click a story — verify `/news/[slug]` page with summary, source cards, and sidebar
4. Test filter pills on `/news` page

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: complete news expansion with stories, AI pipeline, and dedicated pages"
```

# Story Lifecycle & Summary Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add story lifecycle (open/closed states, chapter linking), full article content extraction, pre-computed matching logic to minimise AI calls, and a versioned summary timeline on story pages.

**Architecture:** Stories get a state machine (open→closed) with 3 closure reasons. A `story_summaries` table stores versioned summaries. The ingestion pipeline front-loads deterministic matching (rules + word similarity) so AI is only called for ambiguous cases. RSS parsers extract `content:encoded` for 1News/Herald; page fetching extracts body text for RNZ/Stuff.

**Tech Stack:** Drizzle ORM (libSQL), Anthropic SDK (Haiku + Sonnet), Next.js 16 App Router, existing Biome/Ultracite linting.

**Spec:** `docs/superpowers/specs/2026-04-03-story-lifecycle-design.md`
**Branch:** `feat/news-expansion` (builds on existing work)

---

## File Structure

### New files
```
packages/db/src/schema.ts                              — add story_summaries table + new columns
apps/ingestion/src/collectors/news/lifecycle.ts         — rules engine: close expired/capped stories, compute match candidates
apps/ingestion/src/collectors/news/content-extractor.ts — extract article body from HTML pages
```

### Modified files
```
packages/db/src/queries.ts                             — add story lifecycle queries + story_summaries CRUD
packages/db/src/index.ts                               — export new queries + schema
packages/db/src/__tests__/story-queries.test.ts        — add lifecycle + summary tests
apps/ingestion/src/collectors/news/parse-rss.ts        — add content field to ParsedArticle
apps/ingestion/src/collectors/news/parse-1news.ts      — extract content:encoded
apps/ingestion/src/collectors/news/parse-herald.ts     — extract content:encoded
apps/ingestion/src/collectors/news/ai.ts               — refactor to per-article matching with content
apps/ingestion/src/collectors/news/enrich.ts           — accept full content, return prose summary
apps/ingestion/src/collectors/news/index.ts            — rewrite pipeline with lifecycle + pre-compute
apps/web/lib/queries.ts                                — fetch story summaries for timeline
apps/web/app/news/[slug]/page.tsx                      — summary timeline + chapter links
```

---

### Task 1: Schema — Add `story_summaries` table + lifecycle columns

**Files:**
- Modify: `packages/db/src/schema.ts`

- [ ] **Step 1: Add `status`, `parentStoryId`, `closedReason` columns to `stories` table**

Add three columns before `createdAt` in the stories table definition:

```typescript
  status: text("status").notNull().default("open"),
  parentStoryId: text("parent_story_id"),
  closedReason: text("closed_reason"),
```

- [ ] **Step 2: Add `content` column to `articles` table**

Add before `createdAt` in the articles table definition:

```typescript
  content: text("content"),
```

- [ ] **Step 3: Create `storySummaries` table**

Add after the `stories` table definition:

```typescript
export const storySummaries = sqliteTable("story_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyId: text("story_id").notNull(),
  summary: text("summary").notNull(),
  sources: text("sources").notNull(),
  articleCount: integer("article_count").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
```

- [ ] **Step 4: Push schema**

Run: `bun run db:push`

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat(db): add story_summaries table, lifecycle columns, article content column"
```

---

### Task 2: DB queries — Story lifecycle + summary CRUD

**Files:**
- Modify: `packages/db/src/queries.ts`
- Modify: `packages/db/src/index.ts`
- Modify: `packages/db/src/__tests__/story-queries.test.ts`

- [ ] **Step 1: Write tests for new lifecycle queries**

Add tests to the existing `story-queries.test.ts`:

```typescript
// Test: closeStory sets status and reason
it("closes a story with reason", async () => {
  await upsertStory(db, { /* open story */ });
  await closeStory(db, "test-story", "expired");
  const story = await getStoryBySlug(db, "test-story");
  expect(story!.status).toBe("closed");
  expect(story!.closedReason).toBe("expired");
});

// Test: getOpenStories only returns open stories
it("getOpenStories excludes closed stories", async () => {
  await upsertStory(db, { /* story 1, open */ });
  await upsertStory(db, { /* story 2, open */ });
  await closeStory(db, "story-1", "expired");
  const open = await getOpenStories(db);
  expect(open).toHaveLength(1);
  expect(open[0]!.id).toBe("story-2");
});

// Test: insertStorySummary + getStorySummaries
it("inserts and retrieves story summaries in order", async () => {
  await upsertStory(db, { /* story */ });
  await insertStorySummary(db, {
    storyId: "test-story",
    summary: "First summary",
    sources: JSON.stringify(["rnz"]),
    articleCount: 1,
  });
  await insertStorySummary(db, {
    storyId: "test-story",
    summary: "Second summary",
    sources: JSON.stringify(["rnz", "stuff"]),
    articleCount: 3,
  });
  const summaries = await getStorySummaries(db, "test-story");
  expect(summaries).toHaveLength(2);
  expect(summaries[0]!.summary).toBe("Second summary"); // newest first
});

// Test: getStorySummaryCount
it("counts story summaries", async () => {
  await upsertStory(db, { /* story */ });
  await insertStorySummary(db, { storyId: "test-story", summary: "s1", sources: "[]", articleCount: 1 });
  await insertStorySummary(db, { storyId: "test-story", summary: "s2", sources: "[]", articleCount: 2 });
  const count = await getStorySummaryCount(db, "test-story");
  expect(count).toBe(2);
});

// Test: getChildStory
it("finds child story by parentStoryId", async () => {
  await upsertStory(db, { id: "parent", headline: "Parent", /* ... */ });
  await upsertStory(db, { id: "child", headline: "Child", parentStoryId: "parent", /* ... */ });
  const child = await getChildStory(db, "parent");
  expect(child!.id).toBe("child");
});
```

Also create the `story_summaries` table in the test's `beforeEach` setup SQL.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/db && bun test`

- [ ] **Step 3: Implement lifecycle queries**

Add to `packages/db/src/queries.ts`:

```typescript
import { storySummaries } from "./schema";

export async function closeStory(
  db: Db,
  storyId: string,
  reason: "expired" | "cap_reached" | "superseded"
) {
  await db
    .update(stories)
    .set({ status: "closed", closedReason: reason })
    .where(eq(stories.id, storyId));
}

export async function getOpenStories(db: Db) {
  return db
    .select()
    .from(stories)
    .where(eq(stories.status, "open"))
    .orderBy(desc(stories.updatedAt));
}

export async function getChildStory(db: Db, parentStoryId: string) {
  const rows = await db
    .select()
    .from(stories)
    .where(eq(stories.parentStoryId, parentStoryId))
    .limit(1);
  return rows[0] ?? null;
}

export type NewStorySummary = typeof storySummaries.$inferInsert;

export async function insertStorySummary(db: Db, entry: NewStorySummary) {
  await db.insert(storySummaries).values(entry);
}

export async function getStorySummaries(db: Db, storyId: string) {
  return db
    .select()
    .from(storySummaries)
    .where(eq(storySummaries.storyId, storyId))
    .orderBy(desc(storySummaries.createdAt));
}

export async function getStorySummaryCount(db: Db, storyId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(storySummaries)
    .where(eq(storySummaries.storyId, storyId));
  return result[0]!.count;
}
```

Also update `insertArticles` upsert to include the `content` column:
```typescript
content: sql`excluded.content`,
```

- [ ] **Step 4: Export new queries + schema from DB package**

In `packages/db/src/index.ts`, add exports:
```typescript
export {
  closeStory,
  getChildStory,
  getOpenStories,
  getStorySummaries,
  getStorySummaryCount,
  insertStorySummary,
  type NewStorySummary,
} from "./queries";

export { storySummaries } from "./schema";
```

- [ ] **Step 5: Run tests**

Run: `cd packages/db && bun test`

Expected: All tests pass.

- [ ] **Step 6: Push schema + commit**

```bash
bun run db:push
git add packages/db/
git commit -m "feat(db): add story lifecycle queries, story_summaries CRUD, and tests"
```

---

### Task 3: Content extraction — RSS parsers + page scraping

**Files:**
- Modify: `apps/ingestion/src/collectors/news/parse-rss.ts` (ParsedArticle interface)
- Modify: `apps/ingestion/src/collectors/news/parse-1news.ts`
- Modify: `apps/ingestion/src/collectors/news/parse-herald.ts`
- Create: `apps/ingestion/src/collectors/news/content-extractor.ts`
- Modify: `apps/ingestion/src/collectors/news/index.ts` (content extraction step)

- [ ] **Step 1: Add `content` field to ParsedArticle interface**

In `parse-rss.ts`, add to the interface:
```typescript
export interface ParsedArticle {
  url: string;
  title: string;
  excerpt: string;
  content: string | null;  // NEW — full article text
  imageUrl: string | null;
  publishedAt: string;
  source?: string;
}
```

Update all return sites in `parse-rss.ts` to include `content: null`.

- [ ] **Step 2: Extract `content:encoded` in 1News parser**

In `parse-1news.ts`, find where items are parsed. Add extraction of `<content:encoded>` CDATA:

```typescript
// After extracting description/excerpt, look for content:encoded
const contentMatch = itemXml.match(
  /<content:encoded>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content:encoded>/i
);
const content = contentMatch?.[1]
  ? contentMatch[1]
      .replace(/<[^>]+>/g, " ")  // strip HTML
      .replace(/\s+/g, " ")     // collapse whitespace
      .trim()
      .slice(0, 5000)           // cap at ~5000 chars
  : null;
```

Include `content` in the returned ParsedArticle.

- [ ] **Step 3: Extract `content:encoded` in Herald parser**

Same approach in `parse-herald.ts` — extract `<content:encoded>` CDATA, strip HTML, cap at 5000 chars. Include `content` in returned ParsedArticle.

- [ ] **Step 4: Update Stuff parser to include `content: null`**

In `parse-atom.ts`, add `content: null` to returned objects.

- [ ] **Step 5: Create content extractor for page-fetched content**

Create `apps/ingestion/src/collectors/news/content-extractor.ts`:

```typescript
/**
 * Extracts article body text from HTML pages.
 * Used for RNZ and Stuff where RSS doesn't include content:encoded.
 * Designed to reuse the HTML already fetched for og:image extraction.
 */
export function extractArticleContent(html: string): string | null {
  // Try <article> tag first
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const body = articleMatch?.[1];

  if (!body) {
    // Fallback: look for common content div patterns
    const contentMatch = html.match(
      /<div[^>]*class="[^"]*(?:article-body|story-body|content-body|article__body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (!contentMatch?.[1]) {
      return null;
    }
    return stripHtml(contentMatch[1]);
  }

  return stripHtml(body);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")   // remove scripts
    .replace(/<style[\s\S]*?<\/style>/gi, "")      // remove styles
    .replace(/<[^>]+>/g, " ")                       // strip tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")                           // collapse whitespace
    .trim()
    .slice(0, 5000);                                // cap length
}
```

- [ ] **Step 6: Integrate content extraction into collector**

In `index.ts`, modify the og:image fetch step to also extract body text for articles without `content`. The existing `fetchOgImage` already reads the first 100KB of the page — increase this or do a separate read for content extraction.

After the og:image step, add:
```typescript
// Extract article body for sources without content:encoded (RNZ, Stuff)
for (const article of topArticles) {
  if (!article.content) {
    try {
      const response = await fetch(article.url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const html = await response.text();
        article.content = extractArticleContent(html);
      }
    } catch {
      // Content extraction is best-effort
    }
  }
}
```

Note: This can be batched similarly to the og:image step to avoid memory issues.

- [ ] **Step 7: Run lint + commit**

```bash
bun run check
git add apps/ingestion/src/collectors/news/
git commit -m "feat(ingestion): extract full article content from RSS and page scraping"
```

---

### Task 4: Story lifecycle engine — Rules + similarity scoring

**Files:**
- Create: `apps/ingestion/src/collectors/news/lifecycle.ts`
- Create: `apps/ingestion/src/collectors/news/__tests__/lifecycle.test.ts`

- [ ] **Step 1: Write tests for the lifecycle engine**

Create `apps/ingestion/src/collectors/news/__tests__/lifecycle.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { categorizeArticle, computeWordSimilarity, findStoriesToClose } from "../lifecycle";

describe("findStoriesToClose", () => {
  it("marks stories as expired after 5 days silence", () => {
    const stories = [
      { id: "old", updatedAt: new Date(Date.now() - 6 * 86400000).toISOString(), summaryCount: 1 },
      { id: "recent", updatedAt: new Date().toISOString(), summaryCount: 1 },
    ];
    const toClose = findStoriesToClose(stories);
    expect(toClose).toEqual([{ id: "old", reason: "expired" }]);
  });

  it("marks stories as cap_reached at 5 summaries", () => {
    const stories = [
      { id: "capped", updatedAt: new Date().toISOString(), summaryCount: 5 },
    ];
    const toClose = findStoriesToClose(stories);
    expect(toClose).toEqual([{ id: "capped", reason: "cap_reached" }]);
  });
});

describe("computeWordSimilarity", () => {
  it("finds shared significant words", () => {
    const score = computeWordSimilarity(
      "RBNZ holds OCR at 3.5 percent",
      "Reserve Bank keeps OCR unchanged"
    );
    expect(score).toBeGreaterThanOrEqual(1); // "ocr" shared
  });

  it("returns 0 for unrelated texts", () => {
    const score = computeWordSimilarity(
      "Petrol prices drop to 6-month low",
      "Auckland housing market cools"
    );
    expect(score).toBe(0);
  });
});

describe("categorizeArticle", () => {
  it("returns NO_CANDIDATES when no open stories overlap", () => {
    const result = categorizeArticle(
      { title: "Bananas imported from Ecuador", content: "...", tags: ["groceries"] },
      []
    );
    expect(result.category).toBe("NO_CANDIDATES");
  });

  it("returns HIGH_CONFIDENCE when strong word overlap", () => {
    const result = categorizeArticle(
      { title: "RBNZ holds OCR unchanged amid uncertainty", content: "Reserve Bank OCR decision...", tags: ["interest-rates"] },
      [{ id: "ocr-story", headline: "RBNZ Holds OCR at 3.5% Amid Global Uncertainty", tags: ["interest-rates"] }]
    );
    expect(result.category).toBe("HIGH_CONFIDENCE");
    expect(result.matchedStoryId).toBe("ocr-story");
  });

  it("returns AMBIGUOUS when moderate overlap", () => {
    const result = categorizeArticle(
      { title: "Fuel prices continue to climb", content: "Petrol...", tags: ["fuel"] },
      [
        { id: "fuel-crisis", headline: "NZ Fuel Crisis Deepens", tags: ["fuel"] },
        { id: "fuel-tax", headline: "Government Fuel Tax Under Review", tags: ["fuel", "government"] },
      ]
    );
    expect(result.category).toBe("AMBIGUOUS");
    expect(result.candidates.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/ingestion && bun test src/collectors/news/__tests__/lifecycle.test.ts`

- [ ] **Step 3: Implement lifecycle engine**

Create `apps/ingestion/src/collectors/news/lifecycle.ts`:

```typescript
const SILENCE_THRESHOLD_DAYS = 5;
const SUMMARY_CAP = 5;

// Reuse the stop words from score-articles
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "to", "of",
  "in", "for", "on", "with", "at", "by", "from", "as", "it", "its", "this",
  "that", "and", "or", "but", "not", "will", "would", "could", "should",
  "may", "can", "has", "have", "had", "do", "does", "did", "how", "why",
  "what", "when", "who", "which", "where", "than", "more", "most", "very",
  "just", "also", "says", "said", "new", "after", "over", "into", "up",
  "out", "about", "no", "all", "some", "if", "so", "we", "our", "they",
  "their", "nz", "zealand",
]);

interface StoryState {
  id: string;
  headline: string;
  tags: string[];
  updatedAt: string;
  summaryCount: number;
}

interface ArticleForMatching {
  title: string;
  content: string | null;
  tags: string[];
}

interface CandidateStory {
  id: string;
  headline: string;
  tags: string[];
}

type MatchCategory =
  | { category: "NO_CANDIDATES" }
  | { category: "HIGH_CONFIDENCE"; matchedStoryId: string }
  | { category: "AMBIGUOUS"; candidates: CandidateStory[] };

export function findStoriesToClose(
  stories: { id: string; updatedAt: string; summaryCount: number }[]
): { id: string; reason: "expired" | "cap_reached" }[] {
  const now = Date.now();
  const results: { id: string; reason: "expired" | "cap_reached" }[] = [];

  for (const story of stories) {
    const silenceDays =
      (now - new Date(story.updatedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (story.summaryCount >= SUMMARY_CAP) {
      results.push({ id: story.id, reason: "cap_reached" });
    } else if (silenceDays >= SILENCE_THRESHOLD_DAYS) {
      results.push({ id: story.id, reason: "expired" });
    }
  }

  return results;
}

function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

export function computeWordSimilarity(textA: string, textB: string): number {
  const wordsA = extractSignificantWords(textA);
  const wordsB = extractSignificantWords(textB);
  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) {
      overlap++;
    }
  }
  return overlap;
}

export function categorizeArticle(
  article: ArticleForMatching,
  openStories: CandidateStory[]
): MatchCategory {
  if (openStories.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  // Compute similarity for each open story
  const articleText = `${article.title} ${(article.content ?? "").slice(0, 500)}`;
  const scored: { story: CandidateStory; similarity: number; tagOverlap: number }[] = [];

  for (const story of openStories) {
    const similarity = computeWordSimilarity(articleText, story.headline);
    const tagOverlap = article.tags.filter((t) => story.tags.includes(t)).length;

    if (similarity > 0 || tagOverlap > 0) {
      scored.push({ story, similarity, tagOverlap });
    }
  }

  if (scored.length === 0) {
    return { category: "NO_CANDIDATES" };
  }

  // Sort by similarity desc
  scored.sort((a, b) => b.similarity - a.similarity);

  // High confidence: top match has 4+ shared significant words
  if (scored[0]!.similarity >= 4) {
    return {
      category: "HIGH_CONFIDENCE",
      matchedStoryId: scored[0]!.story.id,
    };
  }

  // Ambiguous: some overlap but not enough for auto-assign
  return {
    category: "AMBIGUOUS",
    candidates: scored.slice(0, 3).map((s) => s.story),
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd apps/ingestion && bun test src/collectors/news/__tests__/lifecycle.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/news/lifecycle.ts apps/ingestion/src/collectors/news/__tests__/lifecycle.test.ts
git commit -m "feat(ingestion): add story lifecycle engine with rules and similarity scoring"
```

---

### Task 5: Refactor AI matching — Per-article focused calls

**Files:**
- Modify: `apps/ingestion/src/collectors/news/ai.ts`

- [ ] **Step 1: Replace batch matching with per-article matching**

The current `matchArticlesToStories` sends all articles in one batch. Replace with a focused per-article function:

```typescript
export async function matchArticleToStory(
  article: { title: string; content: string | null; source: string },
  candidates: { id: string; headline: string; tags: string[] }[]
): Promise<"new" | "standalone" | `continuation:${string}` | `chapter_from:${string}`> {
  const articleContent = (article.content ?? "").slice(0, 300);
  const candidateList = candidates
    .map((c, i) => `${i + 1}. "${c.headline}" (tags: ${c.tags.join(", ")})`)
    .join("\n");

  const prompt = `You are matching a new NZ economic news article to existing stories.

Article: "${article.title}"
Content: "${articleContent}"
Source: ${article.source}

Existing stories this MIGHT belong to:
${candidateList}

Respond with ONE of:
- "continuation:N" — this article is about the same development as story N
- "chapter_from:N" — this is a MAJOR new development related to story N (e.g., government response to an ongoing crisis). Warrants its own story but linked to N.
- "new" — this is unrelated to any listed story
- "standalone" — this is a one-off article unlikely to develop further

Rules:
- "continuation" = same event, same development, just another outlet covering it
- "chapter_from" = a significant escalation, response, or shift in an ongoing story
- When uncertain, prefer "new" over forcing a match
- Only use "chapter_from" for genuinely major developments, not routine follow-ups

Return ONLY the decision string, nothing else.`;

  const response = await callHaiku(prompt);
  const cleaned = response.trim().toLowerCase();

  // Parse response
  if (cleaned.startsWith("continuation:")) {
    const idx = Number.parseInt(cleaned.replace("continuation:", "")) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return `continuation:${candidates[idx]!.id}`;
    }
  }
  if (cleaned.startsWith("chapter_from:")) {
    const idx = Number.parseInt(cleaned.replace("chapter_from:", "")) - 1;
    if (idx >= 0 && idx < candidates.length) {
      return `chapter_from:${candidates[idx]!.id}`;
    }
  }
  if (cleaned === "standalone") {
    return "standalone";
  }
  return "new";
}
```

Keep `tagArticles` unchanged — it still works as a batch call. Remove the old `matchArticlesToStories`, `matchAgainstExisting`, `clusterNewArticles`, and `validateMatches` functions.

- [ ] **Step 2: Update `tagArticles` to accept content**

Update `ArticleInput` to include content:

```typescript
interface ArticleInput {
  title: string;
  excerpt: string;
  content: string | null;
  source: string;
}
```

In the tagging prompt, use `title + first 200 words of content` instead of just `excerpt`:

```typescript
const articleList = articles
  .map((a, i) => {
    const text = a.content ? a.content.slice(0, 400) : a.excerpt;
    return `${i + 1}. Title: "${a.title}" | Content: "${text}"`;
  })
  .join("\n");
```

- [ ] **Step 3: Run lint + commit**

```bash
bun run check
git add apps/ingestion/src/collectors/news/ai.ts
git commit -m "feat(ingestion): refactor AI matching to per-article focused calls with content"
```

---

### Task 6: Update Sonnet enrichment for prose summaries

**Files:**
- Modify: `apps/ingestion/src/collectors/news/enrich.ts`

- [ ] **Step 1: Update enrichStory to use full content and return prose**

Change the prompt to request flowing prose (style D from brainstorm) instead of bullet points. Accept full article content:

```typescript
interface StoryArticle {
  title: string;
  content: string | null;
  excerpt: string;
  source: string;
}
```

Update the prompt to use `content` when available:
```typescript
const articleList = articles
  .map((a) => {
    const body = a.content ? a.content.slice(0, 1500) : a.excerpt;
    return `- [${a.source.toUpperCase()}] "${a.title}" — ${body}`;
  })
  .join("\n\n");
```

Change summary instruction from bullets to prose:
```
1. **summary**: 2-4 paragraphs synthesising the story. Write as flowing editorial prose, like a newspaper brief. Highlight key facts and figures. Do not use bullet points.
```

- [ ] **Step 2: Run lint + commit**

```bash
bun run check
git add apps/ingestion/src/collectors/news/enrich.ts
git commit -m "feat(ingestion): update enrichment to use full content and prose summaries"
```

---

### Task 7: Rewrite collector pipeline with lifecycle integration

**Files:**
- Modify: `apps/ingestion/src/collectors/news/index.ts`

This is the largest task — rewiring the entire pipeline. The new flow:

- [ ] **Step 1: Add imports for new modules**

```typescript
import {
  closeStory,
  getOpenStories,
  getStorySummaryCount,
  insertStorySummary,
} from "@workspace/db";
import { categorizeArticle, findStoriesToClose } from "./lifecycle";
import { extractArticleContent } from "./content-extractor";
import { matchArticleToStory } from "./ai"; // new per-article function
```

- [ ] **Step 2: Rewrite the pipeline after scoring**

Replace the current AI pipeline (lines 178-479) with the new phased approach:

**Phase 2: Pre-compute state**
```typescript
// Fetch all open stories + their summary counts
const openStories = await getOpenStories(db);
const storyStates = await Promise.all(
  openStories.map(async (s) => ({
    ...s,
    summaryCount: await getStorySummaryCount(db, s.id),
    tags: JSON.parse(s.tags) as string[],
  }))
);

// Close expired/capped stories
const toClose = findStoriesToClose(
  storyStates.map((s) => ({
    id: s.id,
    updatedAt: s.updatedAt,
    summaryCount: s.summaryCount,
  }))
);
for (const { id, reason } of toClose) {
  await closeStory(db, id, reason);
  console.log(`[news] Closed story "${id}" (${reason})`);
}

// Remaining open stories are candidates
const candidateStories = storyStates
  .filter((s) => !toClose.some((c) => c.id === s.id))
  .map((s) => ({ id: s.id, headline: s.headline, tags: s.tags }));

// Categorize each article
const articleCategories = topArticles.map((article, i) => {
  const tags = articleTags[i] ?? ["general-economy"];
  return categorizeArticle(
    { title: article.title, content: article.content, tags },
    candidateStories
  );
});
```

**Phase 3: AI decisions (only for AMBIGUOUS)**
```typescript
for (let i = 0; i < topArticles.length; i++) {
  const cat = articleCategories[i]!;

  if (cat.category === "NO_CANDIDATES") {
    // Deterministic: new story
    // Create story, assign storyId
  } else if (cat.category === "HIGH_CONFIDENCE") {
    // Deterministic: auto-assign
    articleStoryIds[i] = cat.matchedStoryId;
  } else if (cat.category === "AMBIGUOUS") {
    // AI decision needed
    const decision = await matchArticleToStory(
      { title: topArticles[i]!.title, content: topArticles[i]!.content, source: topArticles[i]!.source ?? "unknown" },
      cat.candidates
    );
    // Handle: continuation, chapter_from, new, standalone
  }
}
```

**Phase 4: Write + enrich**
- Create new stories, create chapter stories with `parentStoryId`, close superseded stories
- For stories that gained a NEW source outlet: call `enrichStory`, insert into `story_summaries`, update `stories.summary`
- Insert all articles with `storyId`, `tags`, `content`
- Cleanup

- [ ] **Step 3: Update article insertion to include content**

```typescript
const rows: NewArticle[] = topArticles.map((a, i) => ({
  url: a.url,
  title: a.title,
  excerpt: a.excerpt,
  content: a.content ?? null,
  imageUrl: a.imageUrl,
  source: a.source ?? "unknown",
  publishedAt: a.publishedAt,
  tags: articleTags[i]?.length ? JSON.stringify(articleTags[i]) : null,
  storyId: articleStoryIds[i] ?? null,
}));
```

- [ ] **Step 4: Run lint + test collection**

```bash
bun run check
cd apps/ingestion && bun run collect -- --source news
```

- [ ] **Step 5: Commit**

```bash
git add apps/ingestion/src/collectors/news/index.ts
git commit -m "feat(ingestion): rewrite pipeline with lifecycle engine and pre-computed matching"
```

---

### Task 8: Frontend queries — Summary timeline data

**Files:**
- Modify: `apps/web/lib/queries.ts`

- [ ] **Step 1: Update `_getStoryPageData` to include summaries + chapter links**

```typescript
import { getChildStory, getStorySummaries } from "@workspace/db";

async function _getStoryPageData(slug: string) {
  const story = await getStoryBySlug(db, slug);
  if (!story) return null;

  const articles = await getArticlesByStoryId(db, story.id);
  const summaries = await getStorySummaries(db, story.id);

  // Chapter links
  let parentStory: { id: string; headline: string } | null = null;
  let childStory: { id: string; headline: string } | null = null;

  if (story.parentStoryId) {
    const parent = await getStoryBySlug(db, story.parentStoryId);
    if (parent) {
      parentStory = { id: parent.id, headline: parent.headline };
    }
  }

  const child = await getChildStory(db, story.id);
  if (child) {
    childStory = { id: child.id, headline: child.headline };
  }

  // Related metrics (existing logic, unchanged)
  // ...

  return { story, articles, summaries, relatedMetrics: relatedMetricData, parentStory, childStory };
}
```

- [ ] **Step 2: Run lint + commit**

```bash
bun run check
git add apps/web/lib/queries.ts
git commit -m "feat(web): add summary timeline and chapter links to story page data"
```

---

### Task 9: Frontend — Summary timeline + chapter links

**Files:**
- Modify: `apps/web/app/news/[slug]/page.tsx`

- [ ] **Step 1: Replace summary card with timeline design**

Replace the current summary section with the timeline layout (style D — inline prose with segments):

- Latest segment: "LATEST" purple label, timestamp, source logo dots (18px `<Image>` from `/sources/`), bold prose with `<span class="highlight">` on key phrases
- Previous segments: dated, muted, their own source dots
- If more than 3 segments: older ones collapsed behind a "Show earlier updates" toggle (client component)
- Footer: "AI-generated summaries from source articles. Updated as new sources are added."

Each summary from `story_summaries` becomes a segment:
```typescript
{summaries.map((entry, i) => {
  const sources: string[] = JSON.parse(entry.sources);
  const isLatest = i === 0;
  return (
    <div key={entry.id} className={isLatest ? "text-[#2a2520]" : "text-[#555]"}>
      {/* Divider with date + source dots */}
      <div className="flex items-center gap-3 mb-4">
        {isLatest && <span className="update-label">Latest</span>}
        <span className="text-[11px] text-[#998]">{formatDate(entry.createdAt)}</span>
        <div className="flex gap-1">
          {sources.map((s) => (
            <div key={s} className="relative h-[18px] w-[18px] overflow-hidden rounded">
              <Image src={BADGE_COLORS[s]?.logo ?? ""} alt={s} fill sizes="18px" className="object-cover" />
            </div>
          ))}
        </div>
        <div className="flex-1 h-px bg-[#e5e0d5]" />
      </div>
      {/* Prose */}
      <div className={`font-serif text-[${isLatest ? '15' : '14'}px] leading-[1.8] mb-6`}>
        {entry.summary.split("\n\n").map((para, j) => (
          <p key={j} className="mb-3">{para}</p>
        ))}
      </div>
    </div>
  );
})}
```

- [ ] **Step 2: Add chapter link banners**

Above the summary timeline:
```typescript
{parentStory && (
  <Link href={`/news/${parentStory.id}`} className="...banner styles...">
    Continues from: {parentStory.headline} →
  </Link>
)}
```

Below the source coverage:
```typescript
{childStory && (
  <Link href={`/news/${childStory.id}`} className="...banner styles...">
    Continued in: {childStory.headline} →
  </Link>
)}
```

- [ ] **Step 3: Run lint + build**

```bash
bun run check
bun run build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/news/[slug]/page.tsx
git commit -m "feat(web): add summary timeline with source dots and chapter link banners"
```

---

### Task 10: Migration — Backfill existing data

**Files:**
- No new files — run via `bun run db:push` and a one-off script

- [ ] **Step 1: Push schema**

Run `bun run db:push` — adds new columns and table.

- [ ] **Step 2: Migrate existing summaries**

Write a one-off migration in the collector or as a script:

```typescript
// For each story with a non-null summary, insert into story_summaries
const allStories = await db.select().from(stories).where(sql`summary IS NOT NULL`);
for (const story of allStories) {
  const articles = await getArticlesByStoryId(db, story.id);
  const sources = [...new Set(articles.map((a) => a.source))];
  await insertStorySummary(db, {
    storyId: story.id,
    summary: story.summary!,
    sources: JSON.stringify(sources),
    articleCount: articles.length,
  });
}
```

- [ ] **Step 3: Run a full collection to test the new pipeline**

```bash
cd apps/ingestion && bun run collect -- --source news
```

Verify: stories have `status = 'open'`, `story_summaries` has entries, articles have `content` populated.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete story lifecycle migration and end-to-end verification"
```

---

### Task 11: Final build + visual verification

- [ ] **Step 1: Run full build**

```bash
bun run build
```

- [ ] **Step 2: Run all tests**

```bash
cd packages/db && bun test
cd apps/ingestion && bun test
```

- [ ] **Step 3: Visual verification**

Start dev server, navigate to a story page, verify:
- Summary timeline renders with segments
- Source dots show real brand logos
- Chapter links appear if applicable
- Related metrics sidebar still works
- /news grid still works with updated stories

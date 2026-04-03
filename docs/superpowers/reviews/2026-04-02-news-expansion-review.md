# Code Review: News Expansion Feature

**Branch:** `feat/news-expansion` (11 commits, 16 files, +1981/-70 lines)
**Reviewer:** Code Review Agent
**Date:** 2026-04-02

---

## Overall Assessment

This is a well-executed feature that closely follows the spec. The architecture is sound: stories are first-class entities, AI enrichment is properly decoupled from article storage (failures don't block), and the frontend surfaces are clean and complete. Tests are comprehensive and all pass (15 story query tests, 4 slugify tests).

**What was done well:**
- AI pipeline resilience: every AI call is wrapped in try/catch with sensible fallbacks
- Clean separation between tagging (Haiku), matching (Haiku), and enrichment (Sonnet)
- Proper JSON parse validation in both ingestion and frontend
- Tests use file-backed temp DB (avoiding libSQL in-memory pitfalls)
- Frontend is accessible: breadcrumbs, semantic headings, `alt` text, `rel="noopener noreferrer"`
- Caching is properly configured via `unstable_cache` with `["metrics"]` tag

---

## Critical Issues (must fix)

### 1. `sourceCount` race condition when multiple articles match same existing story

**File:** `apps/ingestion/src/collectors/news/index.ts:243-252`

When multiple new articles match the same existing story in one run, each match independently fetches `getArticlesByStoryId` and increments by 1. But the new articles haven't been inserted yet (insertion happens at line 386), so `getArticlesByStoryId` returns the same count each time. If 3 articles match story X that had 2 articles, sourceCount becomes 3 (2+1) instead of 5 (2+3).

**Fix:** Track how many articles have been matched to each story in the current run, and add the total at the end:

```typescript
const storyMatchCounts = new Map<string, number>();
// In the match loop:
storyMatchCounts.set(storyId, (storyMatchCounts.get(storyId) ?? 0) + 1);
// After the loop, upsert once per story with existingArticles.length + totalNewMatches
```

### 2. `next/image` will crash on unexpected image domains

**File:** `apps/web/next.config.mjs:5-17`

Story hero images (`story.imageUrl`) come from articles' `og:image` tags. If an og:image URL uses a CDN subdomain not in the `remotePatterns` list (e.g., `static.stuff.co.nz`, `nzherald-assets.s3.amazonaws.com`, or any future source), `next/image` will throw a runtime error and crash the page.

**Fix:** Either:
- (a) Add a wildcard pattern: `{ hostname: "**.stuff.co.nz" }`, `{ hostname: "**.nzherald.co.nz" }`, etc.
- (b) Add `unoptimized` prop to the story page `<Image>` components that render user-sourced URLs.
- (c) Validate/filter image URLs during ingestion to only keep known-safe domains.

Option (c) is the most robust but (a) is the quickest.

### 3. `getStories` tag filtering breaks pagination

**File:** `packages/db/src/queries.ts:412-437`

Tag filtering is applied in JavaScript *after* `LIMIT` and `OFFSET` are applied at the SQL level. If you request `limit: 10, offset: 0, tag: "housing"` and only 2 of the first 10 rows have the "housing" tag, you get 2 results instead of 10. Page 2 might return overlapping or missing stories.

**Fix:** Apply the `LIKE` filter at the SQL level:
```typescript
const conditions = [gte(stories.updatedAt, cutoff)];
if (tag) {
  conditions.push(sql`${stories.tags} LIKE ${'%"' + tag + '"%'}`);
}
// ...
.where(and(...conditions))
```

This uses SQLite's LIKE on the JSON text column, which works reliably for the fixed taxonomy values.

---

## Important Issues (should fix)

### 4. `deleteOrphanedStories` has N+1 query pattern

**File:** `packages/db/src/queries.ts:486-497`

Fetches all stories, then issues one `COUNT(*)` query per story. With 50+ stories, this means 50+ queries. Replace with a single query:

```typescript
export async function deleteOrphanedStories(db: Db) {
  const orphanIds = await db.run(sql`
    DELETE FROM stories WHERE id NOT IN (
      SELECT DISTINCT story_id FROM articles WHERE story_id IS NOT NULL
    )
  `);
}
```

### 5. `newsPageContent` parses JSON inside render without try/catch

**File:** `apps/web/components/sections/news-page-content.tsx:57,120,137`

Three places call `JSON.parse(s.tags)` directly without error handling. If tags is malformed (e.g., empty string from a failed AI run), this will crash the client component.

The `[slug]/page.tsx` file (line 54-59) correctly wraps this in try/catch via `parseTags()`. The same pattern should be used here.

### 6. Missing `"government"` and `"general-economy"` from filter pills

**File:** `apps/web/components/sections/news-page-content.tsx:18-29`

The `TAGS` array omits `"government"` and `"general-economy"` from the filter pills, but the AI tagger can assign these tags. Stories tagged only with `"government"` or `"general-economy"` would be invisible under any filter except "All".

**Fix:** Add `{ label: "Government", value: "government" }` and `{ label: "General", value: "general-economy" }` to the TAGS array.

### 7. Enrichment only includes current-run articles, not all story articles

**File:** `apps/ingestion/src/collectors/news/index.ts:341-368`

When enriching stories, `story.articleIndices` only references articles from the current run. For existing stories gaining new articles, the Sonnet enrichment only sees the new articles, not the full set. This means summaries and angle analysis are based on incomplete data.

**Fix:** For existing stories, fetch all articles from DB (`getArticlesByStoryId`) and merge with the new articles before calling `enrichStory`.

### 8. `"standalone"` articles are silently dropped

**File:** `apps/ingestion/src/collectors/news/index.ts:230-261`

Articles matched as `"standalone"` by the AI are not assigned to any story (their `articleStoryIds[idx]` stays `null`). They are inserted into the articles table but never appear on `/news` since that page only shows stories. This is a deliberate design choice per the spec, but worth noting: standalone articles are invisible on the frontend. Consider at least creating a single-article story for standalones (as is done for "new" articles), or documenting this behaviour.

---

## Suggestions (nice to have)

### 9. Duplicate `BADGE_COLORS` and `TagPill` components

**Files:**
- `apps/web/app/news/[slug]/page.tsx:11-16` (BADGE_COLORS)
- `apps/web/components/sections/news-section.tsx:7-13` (BADGE_COLORS)
- `apps/web/components/sections/news-page-content.tsx:31-37` (TagPill)
- `apps/web/components/sections/news-section.tsx:26-32` (TagPill)
- `apps/web/app/news/[slug]/page.tsx:154-159` (TagPill)

Three separate definitions of `BADGE_COLORS`, `TagPill`, `SourceBadge`, and `OutletCount`. Consider extracting these to a shared `components/news/` directory.

### 10. Story ID collision not handled

**File:** `apps/ingestion/src/collectors/news/slugify.ts`

The spec says: "Check for collisions, append `-2` if needed." The `slugifyHeadline` function generates a slug but never checks for existing IDs. `upsertStory` uses `onConflictDoUpdate`, so a collision silently overwrites an unrelated story with the same slug.

For v1, collisions are unlikely (slug includes month-year suffix), but worth adding a DB check or using a short hash suffix.

### 11. `getStoryPageData` cache key could collide

**File:** `apps/web/lib/queries.ts:887-893`

The cache key `["story-${slug}"]` is fine, but the cache tag is `["metrics"]` (shared with all dashboard data). This means revalidating metrics also invalidates all story page caches. Consider using a separate `"news"` tag as mentioned in the spec.

### 12. No "Load older stories" pagination on `/news` page

**File:** `apps/web/app/news/page.tsx`

The spec calls for "Load older stories" button with pagination, but the current implementation loads all 50 stories at once with no pagination UI. This is acceptable for v1 given the 30-day rolling window, but worth noting as a gap from the spec.

### 13. `createdAt` change in `insertArticles` upsert

**File:** `packages/db/src/queries.ts:275`

Changed from `createdAt: new Date().toISOString()` to `createdAt: sql\`datetime('now')\``. This changes the timestamp from JS-generated UTC to SQLite-server time. Both should be UTC, but the format differs slightly (`datetime('now')` produces `YYYY-MM-DD HH:MM:SS` without `T` separator or timezone suffix). This could cause inconsistencies with other `createdAt` values that use `$defaultFn(() => new Date().toISOString())`.

---

## Spec Compliance Summary

| Spec Requirement | Status | Notes |
|-----------------|--------|-------|
| `stories` table schema | Done | Matches spec exactly |
| `articles` new columns | Done | `tags` + `storyId` added |
| Haiku article tagging | Done | Batch with retry + fallback |
| Haiku story matching (2-pass) | Done | Match existing + cluster new |
| Sonnet enrichment | Done | Summary + angles + metrics |
| AI failure resilience | Done | Each step isolated, articles always saved |
| Homepage news section | Done | Stories with tags + outlet count |
| `/news` page | Done | Filter pills + lead + grid |
| `/news/[slug]` page | Done | Summary, coverage, sidebar, metrics |
| Masthead nav links | Done | Dashboard + News |
| 30-day cleanup | Done | Articles + orphaned stories |
| `generateMetadata` SEO | Done | On story pages |
| Load older stories pagination | Missing | All stories loaded at once |
| Story card as separate component | Deviation | Inlined rather than extracted to `story-card.tsx` |

---

## Test Coverage

- **packages/db**: 15 tests covering upsert, get, filter, pagination, enrichment, cleanup -- thorough
- **ingestion/slugify**: 4 tests covering basic, special chars, collisions, truncation -- adequate
- **Missing**: No tests for `ai.ts` or `enrich.ts` (understandable given they call external APIs, but mock tests would be valuable)
- **Missing**: No tests for `news-page-content.tsx` client-side filtering logic

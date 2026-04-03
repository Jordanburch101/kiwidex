# Story Lifecycle, Matching & Summary Timeline

**Date:** 2026-04-03
**Status:** Draft
**Depends on:** `2026-04-02-news-expansion-design.md` (implemented on `feat/news-expansion`)

## Overview

Redesign the story matching pipeline and add a story lifecycle system. Stories are living entities that open, accumulate sources, get re-enriched with versioned summaries, and eventually close — either by expiry, summary cap, or being superseded by a new chapter. The AI is called minimally, only for genuinely ambiguous matching decisions, with all deterministic logic pre-computed.

Also adds full article content extraction from RSS feeds and page scraping, improving AI quality across tagging, matching, and summarisation.

## Goals

1. **Reduce AI token usage** by front-loading deterministic logic (rules, similarity scoring) before any AI call
2. **Improve matching accuracy** by extracting full article content instead of 400-char excerpts
3. **Add story lifecycle** with open/closed states and chapter linking for evolving stories
4. **Add summary timeline** — each re-enrichment creates a dated entry, showing how coverage developed over time

## Schema Changes

### Modified `stories` table — 3 new columns

| Column | Type | Purpose |
|--------|------|---------|
| `status` | TEXT NOT NULL DEFAULT 'open' | `open` or `closed` |
| `parentStoryId` | TEXT (nullable) | FK to stories.id — links chapters to parent story |
| `closedReason` | TEXT (nullable) | `expired`, `cap_reached`, or `superseded` |

### New `story_summaries` table

```
story_summaries
├── id              INTEGER PRIMARY KEY AUTOINCREMENT
├── storyId         TEXT NOT NULL           (FK to stories.id)
├── summary         TEXT NOT NULL           (prose summary text)
├── sources         TEXT NOT NULL           (JSON array of source keys at time of generation)
├── articleCount    INTEGER NOT NULL        (total articles when this summary was generated)
├── createdAt       TEXT NOT NULL
```

The `summary` column on `stories` is retained as a denormalized "latest summary" for the /news grid (avoids a join). Updated whenever a new `story_summaries` entry is created.

### Modified `articles` table — 1 new column

| Column | Type | Purpose |
|--------|------|---------|
| `content` | TEXT (nullable) | Full article text, plain text. Extracted from RSS `content:encoded` or page scraping |

### Summary cap

5 entries per story in `story_summaries`. When the 5th is inserted, the story is closed with reason `cap_reached`.

## Content Extraction

### Strategy per source

| Source | Method | Detail |
|--------|--------|--------|
| 1News | RSS `content:encoded` | Already in the feed, currently discarded. Parse and strip HTML. |
| Herald | RSS `content:encoded` | Same Arc Publishing platform as 1News. Parse and strip HTML. |
| RNZ | Page fetch + body extraction | Already fetching page for og:image. Read the `<article>` body and strip HTML. |
| Stuff | Page fetch + body extraction | Already fetching page for og:image. Read the `<article>` body and strip HTML. |

### Parser changes

- `parse-1news.ts`: Extract `content:encoded` from RSS items, strip HTML tags, store as `content` field on `ParsedArticle`
- `parse-herald.ts`: Same — extract `content:encoded`
- `parse-rss.ts` (RNZ): No RSS change. Content extracted during page fetch step.
- `parse-atom.ts` (Stuff): No RSS change. Content extracted during page fetch step.
- Add `content` field to `ParsedArticle` interface (nullable)
- Modify `fetchOgImage` to also extract article body text when content is not already available from RSS

### Impact on article storage

Average article: ~650 words ≈ 3-4KB. 18 articles/run, 30-day retention ≈ 1,080 articles max → ~4MB of content. Negligible for SQLite.

## Story Lifecycle

### State machine

```
                    ┌─────────┐
     new articles──▶│  OPEN   │◀── re-enriched
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            │            │            │
    5 days silent   cap reached   superseded
            │            │        (new chapter)
            │            │            │
            ▼            ▼            ▼
                    ┌─────────┐
                    │ CLOSED  │
                    └─────────┘
```

### Rules (deterministic, pre-AI)

1. **Expiry:** Open story where `updatedAt` is more than 5 days ago → close with reason `expired`
2. **Summary cap:** Open story with 5+ entries in `story_summaries` → close with reason `cap_reached`
3. After closures, remaining open stories are the only candidates for AI matching

### AI decisions (ambiguous cases only)

4. **Continuation:** article belongs to an existing open story → add to it
5. **New story:** article is unrelated to any open story → create standalone
6. **New chapter:** article is a major new development related to an existing story → create new story with `parentStoryId`, close the parent with reason `superseded`

### When a story gains new articles (continuation)

- Update: `updatedAt`, `sourceCount`, `tags` (union of all article tags), `imageUrl` (from newest article)
- If a NEW source outlet joined → trigger re-enrichment → insert `story_summaries` entry → update `stories.summary`
- If same sources, just more articles → no re-enrichment (angle hasn't changed)

### When a new chapter is created

- Create new story with `parentStoryId` pointing to the closed parent
- Close parent with reason `superseded`
- First enrichment on the new story generates its initial summary
- Parent story page shows "Continued in: [child headline]" link
- Child story page shows "Continues from: [parent headline]" link

## Ingestion Pipeline

### Phase 1: Collect (no AI)

```
Fetch 4 RSS feeds
→ Parse articles (extract content:encoded for 1News/Herald)
→ Keyword filter
→ Score → top 18
→ Fetch og:image + extract body text for RNZ/Stuff articles missing content
→ Output: 18 articles with title, excerpt, content (full text), imageUrl
```

### Phase 2: Pre-compute state (no AI)

```
Fetch all open stories from DB
→ For each open story, compute:
    - age_days (days since firstReportedAt)
    - silence_days (days since updatedAt)
    - summary_count (entries in story_summaries)
    - current_sources (set of source outlets)
    - current_article_count
    - tags, headline

→ Apply closure rules:
    - silence_days >= 5 → close (expired)
    - summary_count >= 5 → close (cap_reached)

→ For each new article against remaining open stories, compute:
    - tag_overlap: keyword intersection count
    - word_similarity: significant words shared between article title+content and story headline+tags
    - source_overlap: does this outlet already cover this story?

→ Categorize each article:
    - NO_CANDIDATES (0 open stories with any overlap) → deterministic: new story
    - HIGH_CONFIDENCE (1 story with word_similarity >= 4 significant shared words between article title and story headline) → deterministic: auto-assign
    - AMBIGUOUS (1+ candidates, none high-confidence) → needs AI
```

### Phase 3: AI decisions (minimal)

```
Tag all 18 articles: 1 Haiku call
    Input: title + first 200 words of content per article
    Output: tags from taxonomy

For each AMBIGUOUS article (est. 3-5 per run):
    1 Haiku call per article
    Input: article title + first 300 words of content
           + 2-3 candidate stories (headline, tags, source list, age)
    Output: continuation:<story_id> | new | chapter_from:<story_id>
```

### Phase 4: Write + enrich

```
Create new stories (from "new" assignments)
Close superseded stories (from "chapter_from" assignments)
Create chapter stories with parentStoryId
Update existing stories (sourceCount, tags, imageUrl, updatedAt)
Insert all articles with storyId, tags, content

For stories that gained a NEW SOURCE outlet:
    1 Sonnet call per story
    Input: story headline + full content of all articles in this story
    Output: prose summary (for timeline) + angles + relatedMetrics
    → Insert into story_summaries (summary, sources list, articleCount)
    → Update stories.summary with latest
    → Update stories.angles, stories.relatedMetrics

Cleanup: delete articles > 30 days, delete orphaned stories
```

### Token estimates per run

| Phase | AI Calls | Est. Tokens |
|-------|----------|-------------|
| Tagging | 1 Haiku | ~5K |
| Matching (ambiguous only) | 3-5 Haiku | ~5-7K |
| Enrichment (new source only) | 2-3 Sonnet | ~20-30K |
| **Total** | **6-9 calls** | **~30-40K** |
| **Est. cost/run** | | **~$0.08-0.12** |
| **Est. monthly (2x daily)** | | **~$5-7** |

## Frontend Changes

### `/news/[slug]` story page — summary timeline

Replace single summary card with timeline design (inline prose, style D from brainstorm):

- **Latest segment:** "LATEST" purple label, timestamp, source logo dots (18px brand icons), bold prose with purple-highlighted key phrases
- **Previous segments:** dated, slightly muted text, their own source dots showing which outlets were present at that point
- **Collapsible:** if more than 3 segments, older ones collapsed behind "Show earlier updates"
- **Footer:** "AI-generated summaries from source articles. Updated as new sources are added."

### `/news/[slug]` story page — chapter links

- Story has `parentStoryId`: banner above summary: "Continues from: [parent headline] →"
- Story has been superseded (child story exists with `parentStoryId = this story`): banner at bottom: "Continued in: [child headline] →"

### `/news` grid page

No changes. Stories naturally stay fresh via `updatedAt`, `tags`, `imageUrl` updates on each article addition. Closed stories still appear in the 30-day window.

## New Queries

```typescript
// Story lifecycle
closeStory(db, storyId, reason: 'expired' | 'cap_reached' | 'superseded')
getOpenStories(db)  // replaces getRecentStories — only returns status='open'
getChildStory(db, parentStoryId)  // find chapter that continues from this story

// Story summaries
insertStorySummary(db, { storyId, summary, sources: string[], articleCount })
getStorySummaries(db, storyId)  // all summaries for timeline, newest first
getStorySummaryCount(db, storyId)

// Content
// insertArticles already handles the new 'content' column via upsert
```

## Migration

1. Add `status`, `parentStoryId`, `closedReason` columns to `stories` (nullable except status with default 'open')
2. Add `content` column to `articles` (nullable)
3. Create `story_summaries` table
4. Migrate existing `stories.summary` values: for each story with a non-null summary, insert one `story_summaries` row with current sources and articleCount
5. All existing stories get `status = 'open'` by default

## Out of Scope

- Full-text search across article content
- User-facing "thread" view grouping all chapters
- Notification when a story you viewed gets updated
- Manual story merging/splitting by admin

# News Expansion — Richer Display, Dedicated Page & Story Pages

**Date:** 2026-04-02
**Status:** Draft

## Overview

Expand the news feature from a simple 7-article homepage section into a Ground News-inspired story aggregation system. Stories (not individual articles) become the primary unit. AI (Haiku + Sonnet) handles clustering, tagging, summarisation, and angle analysis.

Three surfaces:
1. **Homepage section** — compact preview of top stories, linking to story pages
2. **`/news` page** — filterable grid of all stories (30-day rolling archive)
3. **`/news/[slug]` story pages** — AI-summarised story with multi-outlet coverage, angle analysis, and related dashboard metrics

## Data Model

### New table: `stories`

```
stories
├── id           TEXT PRIMARY KEY        (slug, e.g. "rbnz-holds-ocr-apr-2026")
├── headline     TEXT NOT NULL           (AI-generated neutral headline)
├── summary      TEXT                    (Sonnet-generated bullet-point summary, stored as markdown)
├── tags         TEXT NOT NULL           (JSON array from taxonomy)
├── angles       TEXT                    (JSON — per-source angle analysis, see below)
├── relatedMetrics TEXT                  (JSON array of metric keys, e.g. ["ocr","mortgage_1yr"])
├── sourceCount  INTEGER NOT NULL        (number of outlets covering this story)
├── imageUrl     TEXT                    (hero image — from highest-scored article)
├── firstReportedAt TEXT NOT NULL        (earliest article publishedAt)
├── updatedAt    TEXT NOT NULL           (most recent article publishedAt)
├── createdAt    TEXT NOT NULL
```

`angles` JSON structure:
```json
[
  {
    "source": "rnz",
    "angle": "Policy focus",
    "description": "Focuses on the RBNZ's reasoning and Governor Orr's statements about global risks"
  },
  {
    "source": "stuff",
    "angle": "Consumer impact",
    "description": "Leads with the mortgage holder perspective and household cost pressures"
  }
]
```

### Modified table: `articles`

Add two columns:
```
├── tags         TEXT                    (JSON array — article-level tags from Haiku)
├── storyId      TEXT                    (FK to stories.id, nullable for unclustered)
```

### Tag taxonomy

Fixed set mapping to dashboard categories:
`housing`, `employment`, `fuel`, `groceries`, `currency`, `markets`, `interest-rates`, `inflation`, `government`, `trade`, `general-economy`

Articles and stories can have multiple tags. Tags are assigned by Haiku.

## Ingestion Pipeline

### Current flow
```
RSS feeds → parse → keyword filter → score → pick top 5 → upsert articles
```

### New flow
```
RSS feeds → parse → keyword filter → score → pick top 15-20
  → Haiku: tag articles (batch)
  → Haiku: match articles to stories (batch)
  → Upsert stories (new + updated)
  → Sonnet: generate summary + angles for new/updated stories
  → Upsert articles with storyId + tags
  → Cleanup: articles > 30 days, orphaned stories
```

### Expanded collection volume

- Increase from top 5 to top 15-20 articles per collection run (using existing 6-factor scoring algorithm, just raising the cap)
- `getLatestArticles` perSource increases from 2 to ~8-10 for the `/news` page queries
- 30-day retention: delete articles where `publishedAt` < 30 days ago at end of each run

## AI Integration (Critical Section)

This is the most complex and non-trivial part of the feature. The AI needs to reliably:
1. Tag articles with topic categories
2. Match articles to existing stories or create new ones
3. Generate neutral story headlines
4. Generate multi-source summaries
5. Analyse reporting angles per outlet

### Step 1: Article Tagging (Haiku, batch)

**When:** During ingestion, after scoring, before story matching.

**Input:** Batch of 15-20 article titles + excerpts.

**Prompt strategy:**
```
You are tagging NZ economic news articles. For each article, assign 1-3 tags from this taxonomy:
housing, employment, fuel, groceries, currency, markets, interest-rates, inflation, government, trade, general-economy

Return a JSON array where each element corresponds to the input article (by index).

Articles:
1. Title: "..." | Excerpt: "..."
2. Title: "..." | Excerpt: "..."
...
```

**Output:** JSON array of tag arrays, e.g. `[["interest-rates", "housing"], ["fuel"], ...]`

**Validation:**
- Parse JSON, verify it's an array with length matching input
- Filter out any tags not in the taxonomy
- Fallback: if parsing fails, retry once. If still fails, assign `["general-economy"]` to all and log warning.

**Cost:** ~1 Haiku call, ~2-3K input tokens, ~500 output tokens. Negligible.

### Step 2: Story Matching (Haiku, batch — the hardest part)

**When:** After tagging. This is where articles get assigned to stories.

**The challenge:** Articles about the same event use different vocabulary, framing, and emphasis. Simple keyword overlap fails on cases like:
- "Fonterra lifts payout forecast" vs "Dairy farmers set for bumper season"
- "Wellington job cuts deepen" vs "Public service restructuring continues"

**Approach: Two-pass matching**

**Pass 1 — Match against existing stories:**
Fetch all stories from the last 3 days (by `updatedAt`). Send Haiku:

```
You are matching new NZ economic news articles to existing stories. A "story" is a real-world event or development covered by multiple outlets.

Existing stories (may be matched):
[
  {"id": "rbnz-ocr-hold-apr-2026", "headline": "RBNZ Holds OCR at 3.5%", "tags": ["interest-rates"]},
  {"id": "petrol-prices-drop-mar-2026", "headline": "Petrol Prices Hit 6-Month Low", "tags": ["fuel"]}
]

New articles to classify:
1. Title: "Reserve Bank keeps rates on hold" | Excerpt: "..." | Source: rnz
2. Title: "Fuel drops below $2.50 in Auckland" | Excerpt: "..." | Source: stuff
3. Title: "Auckland rents fall as vacancies rise" | Excerpt: "..." | Source: herald

For each article, respond with:
- "existing:<story_id>" if it belongs to an existing story
- "new" if it's a genuinely new story not covered by any existing one
- "standalone" if it's a one-off article unlikely to get multi-outlet coverage

Rules:
- Only match if the articles are about the SAME specific event or development, not just the same broad topic
- "Housing costs rise" and "REINZ median price up 3%" might be the same story; "Housing costs rise" and "Government announces first-home grant" are NOT
- When uncertain, prefer "new" over forcing a match to an existing story
- An article can only belong to one story

Return as JSON array: [{"index": 1, "match": "existing:rbnz-ocr-hold-apr-2026"}, {"index": 2, "match": "new"}, ...]
```

**Pass 2 — Cluster "new" articles among themselves:**
If multiple articles were marked "new", send a follow-up:

```
These articles were all marked as new stories. Group any that are about the same event.

Articles:
1. Title: "..." | Excerpt: "..." | Source: rnz
2. Title: "..." | Excerpt: "..." | Source: herald

Return groups as JSON: [{"articles": [1, 2], "headline": "Neutral headline for this story"}, {"articles": [3], "headline": null}]
- Generate a neutral, factual headline for groups of 2+ articles
- Single articles get headline: null (we'll use the article's own title)
```

**Story ID generation:** Slugify the headline + append month-year, e.g. `"RBNZ Holds OCR at 3.5%"` → `"rbnz-holds-ocr-apr-2026"`. Check for collisions, append `-2` if needed.

**Validation & fallback:**
- If JSON parsing fails: retry once, then treat all articles as standalone (no clustering)
- If a returned story ID doesn't exist in the DB: treat that article as "new"
- If an article gets matched to a story that already has an article from the same source: keep the newer article, log a warning
- Log all match decisions for debugging

**Edge cases:**
- **Story spans two topics:** the story inherits tags from all its articles (union). A story about "OCR impact on housing" gets both `interest-rates` and `housing`.
- **Opinion pieces vs reporting:** Haiku sees the excerpt — opinion pieces typically have a different tone. If needed, add an "opinion" flag later, but don't over-engineer this on v1.
- **Evolving stories:** a story about "government restructuring" might get new articles over several days. The 3-day window for existing story matching handles this. After 3 days, a new article on the same topic starts a new story.

### Step 3: Story Enrichment (Sonnet, per new/updated story)

**When:** After story matching, only for stories that are new OR gained new articles since last run.

**Input:** All articles belonging to the story (titles + full excerpts).

**Single Sonnet call per story generates three things:**

```
You are analysing a NZ economic news story covered by multiple outlets for The Kiwidex, an NZ economy dashboard.

Story articles:
- [RNZ] "Reserve Bank holds rates steady as inflation eases" — "The Reserve Bank has kept the OCR at 3.5 percent..."
- [Stuff] "OCR hold disappoints homeowners hoping for rate cuts" — "Homeowners hoping for mortgage relief..."
- [Herald] "RBNZ plays it safe — what it means for your mortgage" — "The central bank's decision to hold was widely expected..."

Generate:
1. **summary**: 3-6 bullet points synthesising the story across all sources. Be factual and neutral. Include specific numbers/data points mentioned. Each bullet should be 1-2 sentences.

2. **angles**: For each source, a short label (2-3 words) and one-sentence description of their reporting angle. Categories like "Policy focus", "Consumer impact", "Market analysis", "Human interest", "Data-driven", "Industry perspective".

3. **relatedMetrics**: Which dashboard metrics does this story directly relate to? Pick from: ocr, cpi, gdp_growth, unemployment, wage_growth, median_income, house_price_median, house_price_index, mortgage_floating, mortgage_1yr, mortgage_2yr, nzd_usd, nzd_aud, nzd_eur, petrol_91, petrol_95, petrol_diesel, electricity_wholesale, milk, eggs, bread, butter, cheese, bananas, nzx_50, minimum_wage

Return as JSON:
{
  "summary": "- Bullet one\n- Bullet two\n...",
  "angles": [{"source": "rnz", "angle": "Policy focus", "description": "..."}],
  "relatedMetrics": ["ocr", "mortgage_1yr", "nzd_usd"]
}
```

**For single-article stories (no clustering):** still run Sonnet but with a simpler prompt — generate a 2-3 bullet summary and relatedMetrics only (no angle analysis needed when there's one source).

**Validation:**
- Parse JSON, verify structure
- Filter `relatedMetrics` to only valid metric keys
- Filter `angles` to only sources that have articles in this story
- If parsing fails: store story without summary/angles, flag for retry on next run

**Cost:** ~1 Sonnet call per new/updated story. With 5-10 stories per run, this is roughly 10-15K input tokens and 2-3K output tokens per run. Still cheap — a few cents per collection run.

### AI Failure Modes & Resilience

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Haiku tagging returns bad JSON | Articles get no tags | Retry once, fallback to `["general-economy"]` |
| Haiku misclusters articles | Wrong articles grouped | 3-day window limits blast radius; log decisions for review |
| Haiku matches to non-existent story | Article assigned to ghost story | Validate story IDs against DB, treat as "new" |
| Sonnet summary is inaccurate | Misleading summary shown to users | Disclaimer on all AI content; summaries can be regenerated |
| Sonnet generates empty/malformed response | Story page has no summary | Store null, flag for retry; page renders without summary section |
| API rate limit / timeout | Collection run partially fails | AI enrichment is a separate step — articles are still saved. Enrichment retried next run. |

**Key principle:** Article collection and storage should never fail because of AI failures. AI enrichment is a post-processing step. If it fails, articles are saved without tags/stories, and enrichment is retried on the next collection run.

## Frontend

### Homepage News Section (modified)

Existing layout stays largely the same:
- Lead story card (horizontal: image left, text right) → links to `/news/[slug]`
- 6 story cards in a 3x2 grid → each links to `/news/[slug]`
- Add topic tags and outlet count badge to cards
- Add "View all →" link to `/news`
- Source badges shown on cards but cards link internally (not to source sites)

### `/news` Page (new route: `app/news/page.tsx`)

Dashboard extension — same masthead, same fonts/colors, same footer.

**Layout (top to bottom):**
1. Masthead with nav links (Dashboard | **News**)
2. Page header: "In the News" + subtitle
3. Filter pills: horizontal row of topic tags from taxonomy. Client-side filtering (all stories loaded via Server Component, pills toggle visibility). Multiple selection possible.
4. Lead story: horizontal card (image left, text right), links to `/news/[slug]`
5. Story grid: 3-column grid of compact cards. Each shows: image (if available), story headline, topic tags, outlet count/source badges, time-ago. Links to `/news/[slug]`.
6. "Load older stories" button (paginated or infinite scroll)
7. Footer (same as homepage)

**Data fetching:** Server Component fetches stories from last 30 days, ordered by `updatedAt` desc. Cached with `["news"]` tag.

### `/news/[slug]` Story Page (new route: `app/news/[slug]/page.tsx`)

**Layout: two-column (main + sidebar)**

**Main column:**
- Hero image (full-width, from lead article's imageUrl, gradient fallback)
- Story headline + tags + "3 outlets" badge + timestamps
- AI Summary section (Sonnet-generated bullet points, "AI" badge, disclaimer)
- Source Coverage section: one card per outlet with image thumbnail (180px left), source badge, outlet name, angle tag, headline, excerpt, "Read on RNZ →" link out

**Sidebar:**
- Coverage Details box: source count, first/last reported, source logos
- "How Sources Report It" box (AI badge): per-source angle tag + one-line description
- Related Metrics box: dashboard metrics this story touches, with current values, change indicators, sparklines. Each row links back to relevant dashboard section.

**For single-article stories:** same layout but no "How Sources Report It" box, shorter summary, source coverage shows just the one article.

**Data fetching:** Server Component fetches story by slug + its articles. Related metrics fetched from DB. All cached with `["news"]` tag.

**Metadata:** Dynamic `generateMetadata` for SEO — story headline as title, summary as description, hero image as og:image.

## New Queries

```typescript
// Get all stories for /news page (paginated)
getStories(db, { days?: number, tag?: string, limit?: number, offset?: number })

// Get single story with its articles for /news/[slug]
getStoryBySlug(db, slug: string)

// Get articles for a story
getArticlesByStoryId(db, storyId: string)

// Insert/update story
upsertStory(db, story: NewStory)

// Update story with AI enrichment
updateStoryEnrichment(db, storyId: string, { summary, angles, relatedMetrics })

// Cleanup
deleteOldArticles(db, beforeDate: string)
deleteOrphanedStories(db)
```

## Migration

- Add `tags` and `storyId` columns to `articles` (nullable, no data loss)
- Create `stories` table
- Existing articles remain — they'll just have null tags/storyId until the next collection run enriches them
- First enriched collection run populates stories from existing articles

## Cost Estimate

Per collection run (~2x daily):
- 1 Haiku call for tagging: ~$0.001
- 1-2 Haiku calls for story matching: ~$0.002
- 5-10 Sonnet calls for story enrichment: ~$0.05-0.10
- **Total: ~$0.05-0.10 per run, ~$3-6/month**

## Out of Scope (v1)

- Additional news sources (Interest.co.nz, Newsroom, etc.) — separate feature
- Email/RSS digest of stories
- User-facing search
- Sentiment trend tracking over time
- Story "following" or notifications

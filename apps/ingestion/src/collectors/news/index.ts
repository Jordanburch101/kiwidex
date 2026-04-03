import {
  closeStory,
  db,
  deleteOldArticles,
  deleteOrphanedStories,
  getArticlesByStoryId,
  getOpenStories,
  getStoryBySlug,
  getStorySummaryCount,
  insertArticles,
  insertStorySummary,
  type NewArticle,
  updateStoryEnrichment,
  upsertStory,
} from "@workspace/db";
import type { CollectorResult } from "../types";
import { matchArticleToStory, tagArticles } from "./ai";
import { extractArticleContent } from "./content-extractor";
import { enrichStory } from "./enrich";
import { matchesEconomyKeywords } from "./keywords";
import { categorizeArticle, findStoriesToClose } from "./lifecycle";
import { parse1NewsRss } from "./parse-1news";
import { parseStuffAtom } from "./parse-atom";
import { parseHeraldRss } from "./parse-herald";
import { type ParsedArticle, parseRnzRss } from "./parse-rss";
import { scoreArticles } from "./score";
import { slugifyHeadline } from "./slugify";

const TAG_TO_METRICS: Record<string, string[]> = {
  fuel: ["petrol_91", "petrol_95", "petrol_diesel"],
  groceries: ["milk", "eggs", "bread", "butter", "cheese", "bananas"],
  housing: ["house_price_median", "mortgage_1yr"],
  employment: ["unemployment", "wage_growth"],
  "interest-rates": ["ocr", "mortgage_1yr", "mortgage_floating"],
  inflation: ["cpi"],
  currency: ["nzd_usd", "nzd_aud"],
  markets: ["nzx_50"],
  "general-economy": ["cpi", "gdp_growth"],
};

function deriveMetricsFromTags(tags: string[]): string[] {
  const metrics = new Set<string>();
  for (const tag of tags) {
    for (const m of TAG_TO_METRICS[tag] ?? []) {
      metrics.add(m);
    }
  }
  return [...metrics].slice(0, 5);
}

const FEEDS = {
  rnz: "https://www.rnz.co.nz/rss/business.xml",
  stuff: "https://www.stuff.co.nz/rss?section=/business",
  herald:
    "https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml",
  onenews: "https://www.1news.co.nz/arc/outboundfeeds/rss/?outputType=xml",
} as const;

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return null;
    }

    // Only read first 100KB — og:image is in <head> but RNZ pages have ~68KB of inline CSS/JS before it
    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }

    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const MAX_BYTES = 102_400;

    while (totalBytes < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) {
        break;
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }
    reader.cancel();

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const html = new TextDecoder().decode(merged);

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

  const [rnzXml, stuffXml, heraldXml, onenewsXml] = await Promise.all([
    fetchFeed(FEEDS.rnz),
    fetchFeed(FEEDS.stuff),
    fetchFeed(FEEDS.herald),
    fetchFeed(FEEDS.onenews),
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

  if (onenewsXml) {
    const items = parse1NewsRss(onenewsXml);
    console.log(`[news] 1News: ${items.length} items parsed`);
    allArticles.push(...items.map((a) => ({ ...a, source: "1news" })));
  }

  // Keyword filter — strict mode for 1News (firehose, needs tighter filtering)
  const filtered = allArticles.filter((a) =>
    matchesEconomyKeywords(a.title, a.excerpt, a.source === "1news")
  );
  console.log(
    `[news] ${filtered.length}/${allArticles.length} articles match economy keywords`
  );

  // Score articles — keep top 18 for AI pipeline
  const scored = scoreArticles(filtered);
  scored.sort((a, b) => b.score - a.score);
  const topArticles = scored.slice(0, 18);
  console.log(`[news] Top ${topArticles.length} scored:`);
  for (const a of topArticles) {
    console.log(`  [${a.score}] [${a.source}] ${a.title}`);
  }

  // Enrich articles without images via og:image fetch (batched to avoid OOM)
  const toEnrich = topArticles.filter((a) => !a.imageUrl);
  if (toEnrich.length > 0) {
    console.log(
      `[news] Fetching og:image for ${toEnrich.length} articles without images...`
    );
    const BATCH_SIZE = 5;
    for (let i = 0; i < toEnrich.length; i += BATCH_SIZE) {
      const batch = toEnrich.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (article) => {
          article.imageUrl = await fetchOgImage(article.url);
        })
      );
    }
    const enrichedCount = toEnrich.filter((a) => a.imageUrl).length;
    console.log(
      `[news] Got images for ${enrichedCount}/${toEnrich.length} articles`
    );
  }

  // Extract article body for sources without content:encoded (RNZ, Stuff)
  const needContent = topArticles.filter((a) => !a.content);
  if (needContent.length > 0) {
    console.log(
      `[news] Extracting body text for ${needContent.length} articles...`
    );
    const BATCH_SIZE = 5;
    for (let i = 0; i < needContent.length; i += BATCH_SIZE) {
      const batch = needContent.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (article) => {
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
        })
      );
    }
    const extracted = needContent.filter((a) => a.content).length;
    console.log(
      `[news] Extracted content for ${extracted}/${needContent.length} articles`
    );
  }

  // --- Phase 2: Pre-compute state ---
  console.log("[news] Pre-computing story state...");

  const openStories = await getOpenStories(db);
  const storyStates = await Promise.all(
    openStories.map(async (s) => ({
      ...s,
      summaryCount: await getStorySummaryCount(db, s.id),
      parsedTags: JSON.parse(s.tags) as string[],
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

  // Remaining open stories are candidates for matching
  const candidateStories = storyStates
    .filter((s) => !toClose.some((c) => c.id === s.id))
    .map((s) => ({ id: s.id, headline: s.headline, tags: s.parsedTags }));

  console.log(
    `[news] ${candidateStories.length} open stories as candidates, ${toClose.length} closed`
  );

  // --- Phase 3: Tag + match articles ---

  // Tag all articles (1 Haiku call)
  let articleTags: string[][] = topArticles.map(() => []);
  try {
    console.log("[news] Tagging articles with AI...");
    const tags = await tagArticles(
      topArticles.map((a) => ({
        title: a.title,
        excerpt: a.excerpt,
        content: a.content,
        source: a.source ?? "unknown",
      }))
    );
    for (let i = 0; i < tags.length; i++) {
      articleTags[i] = tags[i]!;
    }
    console.log(`[news] Tagged ${tags.length} articles`);
  } catch (e) {
    console.warn("[news] Tagging failed:", e);
    articleTags = topArticles.map(() => ["general-economy"]);
  }

  // Categorize each article deterministically
  const articleStoryIds: (string | null)[] = topArticles.map(() => null);
  const storiesNeedingEnrichment = new Map<
    string,
    { headline: string; isNew: boolean }
  >();
  const now = new Date().toISOString();

  let deterministic = 0;
  let aiCalls = 0;

  for (let i = 0; i < topArticles.length; i++) {
    const article = topArticles[i]!;
    const tags = articleTags[i] ?? ["general-economy"];

    const category = categorizeArticle(
      { title: article.title, content: article.content, tags },
      candidateStories
    );

    if (category.category === "NO_CANDIDATES") {
      // Deterministic: create new story
      const storyId = slugifyHeadline(article.title, new Date());
      await upsertStory(db, {
        id: storyId,
        headline: article.title,
        tags: JSON.stringify(tags),
        sourceCount: 1,
        imageUrl: article.imageUrl ?? null,
        firstReportedAt: article.publishedAt,
        updatedAt: now,
      });
      articleStoryIds[i] = storyId;
      storiesNeedingEnrichment.set(storyId, {
        headline: article.title,
        isNew: true,
      });
      deterministic++;
    } else if (category.category === "HIGH_CONFIDENCE") {
      // Deterministic: auto-assign to existing story
      articleStoryIds[i] = category.matchedStoryId;
      deterministic++;
    } else if (category.category === "AMBIGUOUS") {
      // AI needed
      try {
        const decision = await matchArticleToStory(
          {
            title: article.title,
            content: article.content,
            source: article.source ?? "unknown",
          },
          category.candidates
        );
        aiCalls++;

        if (decision.startsWith("continuation:")) {
          const storyId = decision.replace("continuation:", "");
          articleStoryIds[i] = storyId;
        } else if (decision.startsWith("chapter_from:")) {
          const parentId = decision.replace("chapter_from:", "");
          // Close parent, create new chapter
          await closeStory(db, parentId, "superseded");
          // Remove from candidates so subsequent articles can't match to it
          const parentIdx = candidateStories.findIndex(
            (s) => s.id === parentId
          );
          if (parentIdx >= 0) {
            candidateStories.splice(parentIdx, 1);
          }
          const storyId = slugifyHeadline(article.title, new Date());
          await upsertStory(db, {
            id: storyId,
            headline: article.title,
            tags: JSON.stringify(tags),
            sourceCount: 1,
            imageUrl: article.imageUrl ?? null,
            firstReportedAt: article.publishedAt,
            updatedAt: now,
            parentStoryId: parentId,
          });
          articleStoryIds[i] = storyId;
          storiesNeedingEnrichment.set(storyId, {
            headline: article.title,
            isNew: true,
          });
          console.log(
            `[news] New chapter: "${article.title}" (from "${parentId}")`
          );
        } else {
          // "new" or "standalone" — create new story
          const storyId = slugifyHeadline(article.title, new Date());
          await upsertStory(db, {
            id: storyId,
            headline: article.title,
            tags: JSON.stringify(tags),
            sourceCount: 1,
            imageUrl: article.imageUrl ?? null,
            firstReportedAt: article.publishedAt,
            updatedAt: now,
          });
          articleStoryIds[i] = storyId;
          storiesNeedingEnrichment.set(storyId, {
            headline: article.title,
            isNew: true,
          });
        }
      } catch (e) {
        console.warn(`[news] AI matching failed for "${article.title}":`, e);
        // Fallback: create new story
        const storyId = slugifyHeadline(article.title, new Date());
        await upsertStory(db, {
          id: storyId,
          headline: article.title,
          tags: JSON.stringify(tags),
          sourceCount: 1,
          imageUrl: article.imageUrl ?? null,
          firstReportedAt: article.publishedAt,
          updatedAt: now,
        });
        articleStoryIds[i] = storyId;
        storiesNeedingEnrichment.set(storyId, {
          headline: article.title,
          isNew: true,
        });
      }
    }
  }

  console.log(
    `[news] Matching: ${deterministic} deterministic, ${aiCalls} AI calls`
  );

  // Update existing stories that gained new articles
  const existingStoryUpdates = new Map<string, number[]>(); // storyId -> article indices
  for (let i = 0; i < topArticles.length; i++) {
    const storyId = articleStoryIds[i];
    if (storyId && !storiesNeedingEnrichment.has(storyId)) {
      // This is an existing story that got a new article
      const indices = existingStoryUpdates.get(storyId) ?? [];
      indices.push(i);
      existingStoryUpdates.set(storyId, indices);
    }
  }

  for (const [storyId, indices] of existingStoryUpdates) {
    const existingArticles = await getArticlesByStoryId(db, storyId);
    const existingSources = new Set(existingArticles.map((a) => a.source));
    let gainedNewSource = false;

    for (const idx of indices) {
      const source = topArticles[idx]!.source ?? "unknown";
      if (!existingSources.has(source)) {
        gainedNewSource = true;
      }
      existingSources.add(source);
    }

    // Update story metadata
    const story = candidateStories.find((s) => s.id === storyId);
    if (story) {
      const allTags = new Set([...story.tags]);
      for (const idx of indices) {
        for (const tag of articleTags[idx] ?? []) {
          allTags.add(tag);
        }
      }
      // Use newest article's image
      const newestArticle = topArticles[indices.at(-1)!]!;
      await upsertStory(db, {
        id: storyId,
        headline: story.headline,
        tags: JSON.stringify([...allTags]),
        sourceCount: existingSources.size,
        imageUrl: newestArticle.imageUrl ?? null,
        firstReportedAt: existingArticles.at(-1)?.publishedAt ?? now,
        updatedAt: now,
      });

      // Only re-enrich if a NEW source outlet joined
      if (gainedNewSource) {
        storiesNeedingEnrichment.set(storyId, {
          headline: story.headline,
          isNew: false,
        });
      }
    }
  }

  // --- Phase 4: Enrich stories with Sonnet ---
  if (storiesNeedingEnrichment.size > 0) {
    console.log(
      `[news] Enriching ${storiesNeedingEnrichment.size} stories with Sonnet...`
    );
    for (const [storyId, { headline }] of storiesNeedingEnrichment) {
      try {
        // Get all articles for this story (DB + new)
        const dbArticles = await getArticlesByStoryId(db, storyId);
        const newArticles = topArticles.filter(
          (_, i) => articleStoryIds[i] === storyId
        );

        const seen = new Set<string>();
        const storyArticles: {
          title: string;
          content: string | null;
          excerpt: string;
          source: string;
        }[] = [];

        for (const a of dbArticles) {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            storyArticles.push({
              title: a.title,
              content: a.content,
              excerpt: a.excerpt,
              source: a.source,
            });
          }
        }
        for (const a of newArticles) {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            storyArticles.push({
              title: a.title,
              content: a.content,
              excerpt: a.excerpt,
              source: a.source ?? "unknown",
            });
          }
        }

        if (storyArticles.length === 0) {
          continue;
        }

        const enrichment = await enrichStory(headline, storyArticles);
        if (enrichment) {
          // Fallback: if AI returned no metrics, derive from story tags
          if (enrichment.relatedMetrics.length === 0) {
            const storyRow = await getStoryBySlug(db, storyId);
            if (storyRow) {
              const storyTags: string[] = JSON.parse(storyRow.tags);
              enrichment.relatedMetrics = deriveMetricsFromTags(storyTags);
            }
          }

          // Update story enrichment fields
          await updateStoryEnrichment(db, storyId, {
            summary: enrichment.summary,
            angles: JSON.stringify(enrichment.angles),
            relatedMetrics: JSON.stringify(enrichment.relatedMetrics),
          });

          // Insert into story_summaries timeline
          const sources = [...new Set(storyArticles.map((a) => a.source))];
          await insertStorySummary(db, {
            storyId,
            summary: enrichment.summary,
            sources: JSON.stringify(sources),
            articleCount: storyArticles.length,
          });

          console.log(
            `[news] Enriched: "${headline}" (${sources.length} sources, ${storyArticles.length} articles)`
          );
        }
      } catch (e) {
        console.warn(`[news] Enrichment failed for "${headline}":`, e);
      }
    }
  }

  // Insert articles
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

  await insertArticles(db, rows);
  console.log(`[news] Inserted/updated ${rows.length} articles`);

  // Cleanup
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]!;
    await deleteOldArticles(db, thirtyDaysAgo);
    await deleteOrphanedStories(db);
    console.log("[news] Cleanup complete");
  } catch (e) {
    console.warn("[news] Cleanup failed:", e);
  }

  return [];
}

import {
  db,
  deleteOldArticles,
  deleteOrphanedStories,
  getArticlesByStoryId,
  getRecentStories,
  insertArticles,
  type NewArticle,
  updateStoryEnrichment,
  upsertStory,
} from "@workspace/db";
import type { CollectorResult } from "../types";
import { matchArticlesToStories, tagArticles } from "./ai";
import { enrichStory } from "./enrich";
import { matchesEconomyKeywords } from "./keywords";
import { parse1NewsRss } from "./parse-1news";
import { parseStuffAtom } from "./parse-atom";
import { parseHeraldRss } from "./parse-herald";
import { type ParsedArticle, parseRnzRss } from "./parse-rss";
import { scoreArticles } from "./score";
import { slugifyHeadline } from "./slugify";

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

  // --- AI Pipeline (resilient — failures don't block article insertion) ---

  // Track per-article tags and storyId
  const articleTags: string[][] = topArticles.map(() => []);
  const articleStoryIds: (string | null)[] = topArticles.map(() => null);

  // Step 1: Tag articles with Haiku
  try {
    console.log("[news] Tagging articles with AI...");
    const tags = await tagArticles(
      topArticles.map((a) => ({
        title: a.title,
        excerpt: a.excerpt,
        source: a.source ?? "unknown",
      }))
    );
    for (let i = 0; i < tags.length; i++) {
      articleTags[i] = tags[i]!;
    }
    console.log(`[news] Tagged ${tags.length} articles`);
  } catch (e) {
    console.warn("[news] AI tagging failed, proceeding without tags:", e);
    for (let i = 0; i < topArticles.length; i++) {
      articleTags[i] = ["general-economy"];
    }
  }

  // Step 2: Match articles to stories with Haiku
  const storiesNeedingEnrichment: {
    id: string;
    headline: string;
    articleIndices: number[];
  }[] = [];

  try {
    console.log("[news] Matching articles to stories with AI...");
    const existingStories = await getRecentStories(db, 3);
    const { matches, newClusters } = await matchArticlesToStories(
      topArticles.map((a) => ({
        title: a.title,
        excerpt: a.excerpt,
        source: a.source ?? "unknown",
      })),
      existingStories
    );
    console.log(
      `[news] Story matching: ${matches.length} results, ${newClusters.length} new clusters`
    );

    const now = new Date().toISOString();

    // Process matches — collect all matches per story first, then upsert once
    const existingStoryMatches = new Map<
      string,
      { indices: number[]; existing: (typeof existingStories)[number] }
    >();

    for (const m of matches) {
      const idx = m.index - 1; // AI uses 1-based indices
      if (idx < 0 || idx >= topArticles.length) {
        continue;
      }

      if (m.match.startsWith("existing:")) {
        const storyId = m.match.replace("existing:", "");
        articleStoryIds[idx] = storyId;

        const existing = existingStories.find((s) => s.id === storyId);
        if (existing) {
          const entry = existingStoryMatches.get(storyId);
          if (entry) {
            entry.indices.push(idx);
          } else {
            existingStoryMatches.set(storyId, {
              indices: [idx],
              existing,
            });
          }
        }
      }
      // "new" and "standalone" handled below
    }

    // Now upsert existing stories once with correct sourceCount
    for (const [storyId, { indices, existing }] of existingStoryMatches) {
      const existingArticles = await getArticlesByStoryId(db, storyId);
      const existingSources = new Set(existingArticles.map((a) => a.source));
      for (const idx of indices) {
        existingSources.add(topArticles[idx]!.source ?? "unknown");
      }

      await upsertStory(db, {
        id: storyId,
        headline: existing.headline,
        tags: existing.tags,
        sourceCount: existingSources.size,
        imageUrl: existing.imageUrl,
        firstReportedAt: existing.firstReportedAt,
        updatedAt: now,
      });
      storiesNeedingEnrichment.push({
        id: storyId,
        headline: existing.headline,
        articleIndices: indices,
      });
    }

    // Process new clusters — group articles into stories
    const newMatchIndices = new Set(
      matches.filter((m) => m.match === "new").map((m) => m.index - 1)
    );

    for (const cluster of newClusters) {
      const clusterIndices = cluster.articles
        .map((i) => i - 1)
        .filter((i) => i >= 0 && i < topArticles.length);
      if (clusterIndices.length === 0) {
        continue;
      }

      const firstArticle = topArticles[clusterIndices[0]!]!;
      const headline = cluster.headline ?? firstArticle.title;
      const storyId = slugifyHeadline(headline, new Date());
      const storyTags = articleTags[clusterIndices[0]!] ?? ["general-economy"];

      await upsertStory(db, {
        id: storyId,
        headline,
        tags: JSON.stringify(storyTags),
        sourceCount: clusterIndices.length,
        imageUrl: firstArticle.imageUrl ?? null,
        firstReportedAt: firstArticle.publishedAt,
        updatedAt: now,
      });

      for (const ci of clusterIndices) {
        articleStoryIds[ci] = storyId;
        newMatchIndices.delete(ci); // Mark as handled
      }

      storiesNeedingEnrichment.push({
        id: storyId,
        headline,
        articleIndices: clusterIndices,
      });
    }

    // Handle remaining "new" articles not in any cluster — single-article stories
    for (const idx of newMatchIndices) {
      if (idx < 0 || idx >= topArticles.length) {
        continue;
      }
      const article = topArticles[idx]!;
      const storyId = slugifyHeadline(article.title, new Date());
      const storyTags = articleTags[idx] ?? ["general-economy"];

      await upsertStory(db, {
        id: storyId,
        headline: article.title,
        tags: JSON.stringify(storyTags),
        sourceCount: 1,
        imageUrl: article.imageUrl ?? null,
        firstReportedAt: article.publishedAt,
        updatedAt: now,
      });

      articleStoryIds[idx] = storyId;
      storiesNeedingEnrichment.push({
        id: storyId,
        headline: article.title,
        articleIndices: [idx],
      });
    }

    // Handle "standalone" articles — also create single-article stories
    // so they appear on /news
    for (const m of matches) {
      const idx = m.index - 1;
      if (m.match !== "standalone" || idx < 0 || idx >= topArticles.length) {
        continue;
      }
      if (articleStoryIds[idx]) {
        continue; // Already assigned
      }
      const article = topArticles[idx]!;
      const storyId = slugifyHeadline(article.title, new Date());
      const storyTags = articleTags[idx] ?? ["general-economy"];

      await upsertStory(db, {
        id: storyId,
        headline: article.title,
        tags: JSON.stringify(storyTags),
        sourceCount: 1,
        imageUrl: article.imageUrl ?? null,
        firstReportedAt: article.publishedAt,
        updatedAt: now,
      });

      articleStoryIds[idx] = storyId;
      storiesNeedingEnrichment.push({
        id: storyId,
        headline: article.title,
        articleIndices: [idx],
      });
    }
  } catch (e) {
    console.warn(
      "[news] AI story matching failed, proceeding without stories:",
      e
    );
  }

  // Step 3: Enrich stories with Sonnet (summary + angles)
  if (storiesNeedingEnrichment.length > 0) {
    console.log(
      `[news] Enriching ${storiesNeedingEnrichment.length} stories with AI...`
    );
    for (const story of storiesNeedingEnrichment) {
      try {
        // Merge existing DB articles with new articles from this run
        const dbArticles = await getArticlesByStoryId(db, story.id);
        const newRunArticles = story.articleIndices
          .map((i) => topArticles[i])
          .filter((a): a is ParsedArticle => a != null);

        // Deduplicate by URL (DB articles + new articles)
        const seen = new Set<string>();
        const storyArticles: { title: string; excerpt: string; source: string }[] = [];

        for (const a of dbArticles) {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            storyArticles.push({ title: a.title, excerpt: a.excerpt, source: a.source });
          }
        }
        for (const a of newRunArticles) {
          if (!seen.has(a.url)) {
            seen.add(a.url);
            storyArticles.push({ title: a.title, excerpt: a.excerpt, source: a.source ?? "unknown" });
          }
        }

        if (storyArticles.length === 0) {
          continue;
        }

        const enrichment = await enrichStory(story.headline, storyArticles);
        if (enrichment) {
          await updateStoryEnrichment(db, story.id, {
            summary: enrichment.summary,
            angles: JSON.stringify(enrichment.angles),
            relatedMetrics: JSON.stringify(enrichment.relatedMetrics),
          });
          console.log(`[news] Enriched story: ${story.headline}`);
        }
      } catch (e) {
        console.warn(`[news] Failed to enrich story "${story.headline}":`, e);
      }
    }
  }

  // Step 4: Insert articles with tags and storyIds
  const rows: NewArticle[] = topArticles.map((a, i) => ({
    url: a.url,
    title: a.title,
    excerpt: a.excerpt,
    imageUrl: a.imageUrl,
    source: a.source ?? "unknown",
    publishedAt: a.publishedAt,
    tags:
      articleTags[i] && articleTags[i]!.length > 0
        ? JSON.stringify(articleTags[i])
        : null,
    storyId: articleStoryIds[i] ?? null,
  }));

  await insertArticles(db, rows);
  console.log(`[news] Inserted/updated ${rows.length} articles`);

  // Step 5: Cleanup — delete old articles and orphaned stories
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

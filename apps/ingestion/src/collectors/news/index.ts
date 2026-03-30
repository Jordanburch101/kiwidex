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

  const allArticles: ParsedArticle[] = [];

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
    (a) => a.source === "rnz" && !a.imageUrl
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
    source: a.source ?? "unknown",
    publishedAt: a.publishedAt,
  }));

  await insertArticles(db, rows);
  console.log(`[news] Inserted/updated ${rows.length} articles`);

  // Return empty — news doesn't produce metric data points
  return [];
}

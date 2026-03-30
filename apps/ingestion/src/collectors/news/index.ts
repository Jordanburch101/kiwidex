import { db, insertArticles, type NewArticle } from "@workspace/db";
import type { CollectorResult } from "../types";
import { matchesEconomyKeywords } from "./keywords";
import { parseStuffAtom } from "./parse-atom";
import { parseHeraldRss } from "./parse-herald";
import { parse1NewsRss } from "./parse-1news";
import { type ParsedArticle, parseRnzRss } from "./parse-rss";
import { scoreArticles } from "./score";

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
    console.log(
      `[news] Got images for ${enriched}/${toEnrich.length} articles`
    );
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

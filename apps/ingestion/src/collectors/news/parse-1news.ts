import { stripHtml as stripHtmlFull } from "./content-extractor";
import type { ParsedArticle } from "./parse-rss";

/**
 * Parse 1News Arc Publishing RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description>, <pubDate>, <media:content url="..." />
 * Images via media:content at multiple resolutions (same Arc format as Herald).
 * Feed URL: https://www.1news.co.nz/arc/outboundfeeds/rss/?outputType=xml
 * Note: No section-specific feeds — all-sections firehose, filtered by keywords.
 */
export function parse1NewsRss(xml: string): ParsedArticle[] {
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

    const contentMatch = item.match(
      /<content:encoded>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/content:encoded>/i
    );
    const content = contentMatch?.[1]
      ? stripHtmlFull(contentMatch[1])
      : null;

    articles.push({
      url: link,
      title: decodeEntities(stripCdata(title)).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
      content,
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
  const matches = [...xml.matchAll(/<media:content[^>]+url="([^"]+)"[^>]*>/gi)];
  if (matches.length === 0) {
    return null;
  }
  const url = matches.at(-1)?.[1] ?? null;
  return url?.replaceAll("&amp;", "&") ?? null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(text: string): string {
  return decodeEntities(text.replace(/<[^>]+>/g, ""));
}

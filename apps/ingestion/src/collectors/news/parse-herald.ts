import type { ParsedArticle } from "./parse-rss";

/**
 * Parse NZ Herald Business RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description>, <pubDate>, <media:content url="..." />
 * Images available via media:content at multiple resolutions.
 * Feed URL: https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/business/?outputType=xml
 */
export function parseHeraldRss(xml: string): ParsedArticle[] {
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

    articles.push({
      url: link,
      title: stripCdata(title).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
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
  // Grab the largest media:content image (last one tends to be largest)
  const matches = [...xml.matchAll(/<media:content[^>]+url="([^"]+)"[^>]*>/gi)];
  if (matches.length === 0) {
    return null;
  }
  // Return the last match (typically the largest resolution)
  return matches.at(-1)?.[1] ?? null;
}

function stripCdata(text: string): string {
  return text.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

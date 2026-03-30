import type { ParsedArticle } from "./parse-rss";

/**
 * Parse Newsroom WordPress RSS 2.0 feed (economy category).
 * Fields: <item> → <title>, <link>, <description> (CDATA with <img>), <pubDate>, <content:encoded>
 * Images embedded as <img> tags inside CDATA description — need HTML extraction.
 * Feed URL: https://newsroom.co.nz/category/economy/feed/
 */
export function parseNewsroomRss(xml: string): ParsedArticle[] {
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
    const imageUrl = extractImageFromHtml(description ?? "");

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

/**
 * Extract the first <img src="..."> from HTML content (inside CDATA).
 * Newsroom embeds article images in the description field.
 */
function extractImageFromHtml(html: string): string | null {
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  const url = match?.[1] ?? null;
  return url?.replaceAll("&amp;", "&") ?? null;
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

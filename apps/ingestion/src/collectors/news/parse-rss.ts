export interface ParsedArticle {
  url: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  publishedAt: string;
  source?: string;
}

/**
 * Parse RNZ Business RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description> (CDATA), <pubDate>, <guid>
 * No image tags in the feed — imageUrl will always be null here.
 */
export function parseRnzRss(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]!;

    const title = extractTag(item, "title");
    const link = extractTag(item, "link");
    const description = extractTag(item, "description");
    const pubDate = extractTag(item, "pubDate");

    if (!title || !link) continue;

    articles.push({
      url: link,
      title: stripCdata(title).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 200)
        .trim(),
      imageUrl: null,
      publishedAt: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    });
  }

  return articles;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle both regular content and CDATA
  const regex = new RegExp(
    `<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    "i"
  );
  const match = xml.match(regex);
  if (!match) return null;
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

import type { ParsedArticle } from "./parse-rss";

/**
 * Parse interest.co.nz RSS 2.0 feed.
 * Fields: <item> → <title>, <link>, <description>, <pubDate>, <dc:creator>
 * No images in the feed — imageUrl always null (enriched via og:image later).
 * Non-standard pubDate format: "30th Mar 26, 3:15pm"
 * Feed URL: https://www.interest.co.nz/rss
 */
export function parseInterestRss(xml: string): ParsedArticle[] {
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

    if (!(title && link)) {
      continue;
    }

    articles.push({
      url: link,
      title: decodeEntities(stripCdata(title)).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
      content: null,
      imageUrl: null,
      publishedAt: parseInterestDate(pubDate ?? ""),
    });
  }

  return articles;
}

/**
 * Parse interest.co.nz's non-standard date format: "30th Mar 26, 3:15pm"
 * Strips ordinal suffix, parses as "D Mon YY, h:mma", assumes NZST (+12:00).
 */
function parseInterestDate(dateStr: string): string {
  try {
    // Strip ordinal suffix: "30th" → "30"
    const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/i, "$1");
    // "30 Mar 26, 3:15pm" → parse parts
    const match = cleaned.match(/(\d+)\s+(\w+)\s+(\d+),\s*(\d+):(\d+)(am|pm)/i);
    if (!match) {
      return new Date().toISOString();
    }

    const [, day, monthStr, yearShort, hourStr, minute, ampm] = match;
    const months: Record<string, number> = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const month = months[monthStr!.toLowerCase()] ?? 0;
    const year = 2000 + Number(yearShort);
    let hour = Number(hourStr);
    if (ampm!.toLowerCase() === "pm" && hour !== 12) {
      hour += 12;
    }
    if (ampm!.toLowerCase() === "am" && hour === 12) {
      hour = 0;
    }

    // Create date in NZST (+12:00)
    const date = new Date(
      Date.UTC(year, month, Number(day), hour - 12, Number(minute))
    );
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
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

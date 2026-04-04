import type { ParsedArticle } from "./parse-rss";

/**
 * Generic RSS 2.0 parser for international feeds.
 * Handles standard <item> elements with optional <media:content> for images.
 * Works for: Guardian, BBC, ABC AU, SCMP, eDairy News.
 */
export function parseInternationalRss(xml: string): ParsedArticle[] {
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
      url: link.trim(),
      title: decodeEntities(stripCdata(title)).trim(),
      excerpt: stripHtml(stripCdata(description ?? ""))
        .slice(0, 400)
        .trim(),
      content: null,
      imageUrl,
      publishedAt: pubDate
        ? new Date(pubDate).toISOString()
        : new Date().toISOString(),
    });
  }

  return articles;
}

function extractMediaContent(xml: string): string | null {
  // Try <media:content url="..."> (used by Guardian, SCMP, eDairy)
  const media = xml.match(/<media:content[^>]+url="([^"]+)"/i);
  if (media?.[1]) {
    return upgradeImageUrl(decodeUrl(media[1]));
  }

  // Try <media:thumbnail url="..."> (used by BBC, some feeds)
  const thumb = xml.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (thumb?.[1]) {
    return decodeUrl(thumb[1]);
  }

  // Try <enclosure url="..." type="image/...">
  const enclosure = xml.match(
    /<enclosure[^>]+url="([^"]+)"[^>]+type="image\//i
  );
  if (enclosure?.[1]) {
    return decodeUrl(enclosure[1]);
  }

  // Try <img src="..."> inside description CDATA (skip tiny emoji/icon images)
  const img = xml.match(/<img[^>]+src="([^"]+)"/i);
  const imgUrl = img?.[1] ? decodeUrl(img[1]) : null;
  if (imgUrl && /emoji|72x72|s\.w\.org/i.test(imgUrl)) {
    return null;
  }
  return imgUrl;
}

/** Decode XML-escaped URL attributes (e.g. &amp; → &) */
function decodeUrl(url: string): string {
  return url
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

/**
 * Guardian RSS serves signed 140px thumbnails that can't be resized.
 * Return null so the og:image enrichment step fetches the full-res article image instead.
 */
function upgradeImageUrl(url: string): string | null {
  if (url.includes("i.guim.co.uk")) {
    return null;
  }
  return url;
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
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201C")
    .replace(/&ldquo;/g, "\u201D")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(text: string): string {
  // Decode entities first so &lt;p&gt; becomes <p>, then strip all tags
  return decodeEntities(text)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

import type { ParsedArticle } from "./parse-rss";

/**
 * Parse Stuff Business Atom feed.
 * Fields: <entry> → <title>, <link href="...">, <summary>, <published>, <media:content url="...">
 */
export function parseStuffAtom(xml: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  for (
    let match = entryRegex.exec(xml);
    match !== null;
    match = entryRegex.exec(xml)
  ) {
    const entry = match[1]!;

    const title = extractAtomTag(entry, "title");
    const link = extractAtomLink(entry);
    const summary = extractAtomTag(entry, "summary");
    const published = extractAtomTag(entry, "published");
    const imageUrl = extractMediaContent(entry);

    if (!(title && link)) {
      continue;
    }

    articles.push({
      url: link,
      title: title.trim(),
      excerpt: (summary ?? "").slice(0, 400).trim(),
      content: null,
      imageUrl,
      publishedAt: published
        ? new Date(published).toISOString()
        : new Date().toISOString(),
    });
  }

  return articles;
}

function extractAtomTag(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function extractAtomLink(xml: string): string | null {
  // Atom links: <link href="..." rel="alternate" />  or  <link href="..." />
  const match = xml.match(/<link[^>]+href="([^"]+)"[^>]*\/?>/i);
  return match?.[1] ?? null;
}

function extractMediaContent(xml: string): string | null {
  const match = xml.match(/<media:content[^>]+url="([^"]+)"/i);
  return match?.[1] ?? null;
}

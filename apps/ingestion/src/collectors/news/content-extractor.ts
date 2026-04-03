/**
 * Extracts article body text from HTML pages.
 * Used for RNZ and Stuff where RSS doesn't include content:encoded.
 */
export function extractArticleContent(html: string): string | null {
  // Try <article> tag first
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  const body = articleMatch?.[1];

  if (!body) {
    // Fallback: look for common content div patterns
    const contentMatch = html.match(
      /<div[^>]*class="[^"]*(?:article-body|story-body|content-body|article__body)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    );
    if (!contentMatch?.[1]) {
      return null;
    }
    return stripHtml(contentMatch[1]);
  }

  return stripHtml(body);
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}

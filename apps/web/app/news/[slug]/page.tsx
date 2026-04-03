import { Sparkline } from "@workspace/ui/components/sparkline";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timeAgo } from "@/lib/data";
import { getStoryPageData } from "@/lib/queries";

// ---------- Constants ----------

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  "1news": { bg: "#00274e", label: "1News" },
};

const ANGLE_STYLES: Record<string, string> = {
  "Policy focus": "bg-[#ede9fe] text-[#6d28d9]",
  "Consumer impact": "bg-[#fef3c7] text-[#92400e]",
  "Market analysis": "bg-[#e0f2fe] text-[#0369a1]",
  "Human interest": "bg-[#fce7f3] text-[#9d174d]",
  "Data-driven": "bg-[#ecfdf5] text-[#065f46]",
  "Industry perspective": "bg-[#f5f3ff] text-[#5b21b6]",
};

// ---------- Metadata ----------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoryPageData(slug);

  if (!data) {
    return { title: "Story Not Found — The Kiwidex" };
  }

  return {
    title: `${data.story.headline} — The Kiwidex`,
    description: data.story.summary?.slice(0, 200) ?? data.story.headline,
    openGraph: {
      title: data.story.headline,
      description: data.story.summary?.slice(0, 200) ?? data.story.headline,
      images: data.story.imageUrl ? [data.story.imageUrl] : undefined,
    },
  };
}

// ---------- Helpers ----------

function parseTags(tags: string): string[] {
  try {
    return JSON.parse(tags) as string[];
  } catch {
    return [];
  }
}

function parseAngles(
  angles: string | null
): { source: string; angle: string; description: string }[] {
  if (!angles) {
    return [];
  }
  try {
    return JSON.parse(angles) as {
      source: string;
      angle: string;
      description: string;
    }[];
  } catch {
    return [];
  }
}

function getAngleForSource(
  angles: { source: string; angle: string; description: string }[],
  source: string
): { angle: string; description: string } | undefined {
  return angles.find((a) => a.source.toLowerCase() === source.toLowerCase());
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function summaryToBullets(summary: string): string[] {
  return summary
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

// ---------- Sub-components ----------

function Breadcrumb({ headline }: { headline: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 font-sans text-[12px] text-[#998]"
    >
      <Link className="transition-colors hover:text-[#555]" href="/news">
        News
      </Link>
      <span className="text-[#d5d0c5]">/</span>
      <span className="max-w-[400px] truncate text-[#777]">{headline}</span>
    </nav>
  );
}

function SourceBadge({ source }: { source: string }) {
  const badge = BADGE_COLORS[source.toLowerCase()];
  if (!badge) {
    return (
      <span className="rounded bg-[#555] px-2 py-0.5 font-sans font-bold text-[9px] text-white tracking-wide">
        {source}
      </span>
    );
  }
  return (
    <span
      className="rounded px-2 py-0.5 font-sans font-bold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: badge.bg }}
    >
      {badge.label}
    </span>
  );
}

function AngleTag({ angle }: { angle: string }) {
  const style = ANGLE_STYLES[angle] ?? "bg-[#f0f0f0] text-[#555]";
  return (
    <span
      className={`rounded px-2 py-0.5 font-sans font-semibold text-[10px] ${style}`}
    >
      {angle}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="rounded-full bg-[#e8e3d9] px-3 py-1 font-sans font-medium text-[11px] text-[#555]">
      {tag}
    </span>
  );
}

// ---------- Page ----------

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getStoryPageData(slug);

  if (!data) {
    notFound();
  }

  const { story, articles, relatedMetrics } = data;
  const tags = parseTags(story.tags);
  const angles = parseAngles(story.angles);
  const summaryBullets = story.summary ? summaryToBullets(story.summary) : [];

  return (
    <article className="pb-12">
      {/* Breadcrumb */}
      <div className="px-6 pt-6 pb-4">
        <Breadcrumb headline={story.headline} />
      </div>

      {/* Hero image */}
      {story.imageUrl ? (
        <div className="relative h-[300px] overflow-hidden sm:h-[400px]">
          <Image
            alt={story.headline}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1200px"
            src={story.imageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        </div>
      ) : null}

      {/* Story header */}
      <header className="border-[#e5e0d5] border-b px-6 pt-8 pb-6">
        <div className="mb-4 flex flex-wrap items-center gap-2.5">
          {story.sourceCount > 1 && (
            <span className="rounded bg-[#2a2520] px-2.5 py-1 font-sans font-bold text-[10px] text-white tracking-wide">
              {story.sourceCount} OUTLETS
            </span>
          )}
          {tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
        <h1 className="max-w-[720px] text-balance font-bold font-heading text-[28px] text-[#2a2520] leading-[1.2] sm:text-[36px]">
          {story.headline}
        </h1>
        <div className="mt-3 flex items-center gap-1.5 font-sans text-[12px] text-[#998]">
          <span>First reported {timeAgo(story.firstReportedAt)}</span>
          <span className="text-[#d5d0c5]">&middot;</span>
          <span>Updated {timeAgo(story.updatedAt)}</span>
        </div>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-0 px-6 pt-2 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-10 py-6 lg:border-[#e5e0d5] lg:border-r lg:pr-8">
          {/* AI Summary */}
          {summaryBullets.length > 0 ? (
            <section className="rounded-lg border border-[#e5e0d5] bg-[#faf9f6]">
              <div className="flex items-center gap-2.5 border-[#e5e0d5] border-b px-5 py-3.5">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
                  <svg
                    className="h-3 w-3 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
                    <path d="M19 14l.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7L15.4 18l2.7-.9z" />
                  </svg>
                </span>
                <h2 className="font-heading font-semibold text-[14px] text-[#2a2520]">
                  Story Summary
                </h2>
              </div>
              <div className="mx-5 my-4 border-[#8b5cf6]/20 border-l-[3px] pl-4">
                <ul className="list-none space-y-3">
                  {summaryBullets.map((bullet) => (
                    <li
                      className="relative pl-3 font-sans text-[13.5px] text-[#333] leading-[1.7] before:absolute before:top-[0.6em] before:left-0 before:h-[5px] before:w-[5px] before:rounded-full before:bg-[#8b5cf6]/30 before:content-['']"
                      key={bullet}
                    >
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border-[#e5e0d5] border-t px-5 py-2.5">
                <p className="font-sans text-[10px] text-[#bbb]">
                  AI-generated summary from source articles
                </p>
              </div>
            </section>
          ) : null}

          {/* Source Coverage */}
          <section>
            <div className="mb-5 border-[#e5e0d5] border-b pb-3">
              <h2 className="font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
                Source Coverage
              </h2>
            </div>
            <div className="space-y-3">
              {articles.map((article) => {
                const articleAngle = getAngleForSource(angles, article.source);
                const badge = BADGE_COLORS[article.source.toLowerCase()];
                return (
                  <a
                    className="group grid overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-[200px_1fr]"
                    href={article.url}
                    key={article.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-[160px] overflow-hidden sm:h-full">
                      {article.imageUrl ? (
                        <Image
                          alt={article.title}
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          fill
                          sizes="200px"
                          src={article.imageUrl}
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            background:
                              "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
                          }}
                        />
                      )}
                    </div>

                    {/* Text */}
                    <div className="flex min-w-0 flex-col px-5 py-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <SourceBadge source={article.source} />
                        <span className="font-sans font-semibold text-[13px] text-[#2a2520]">
                          {badge?.label ?? article.source}
                        </span>
                        {articleAngle ? (
                          <AngleTag angle={articleAngle.angle} />
                        ) : null}
                        <span className="ml-auto font-sans text-[10px] text-[#998]">
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>
                      <h3 className="mb-1.5 font-heading font-bold text-[16px] text-[#2a2520] leading-snug">
                        {article.title}
                      </h3>
                      <p className="line-clamp-2 font-sans text-[13px] text-[#666] leading-[1.6]">
                        {article.excerpt}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1 border-[#d5d0c5] border-b pb-0.5 font-sans font-medium text-[12px] text-[#998] transition-colors group-hover:border-[#2a2520] group-hover:text-[#2a2520]">
                        Read on {badge?.label ?? article.source}
                        <span className="text-[14px]">→</span>
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 py-6 lg:pl-6">
          {/* Coverage Details */}
          <div className="rounded-lg border border-[#e5e0d5] p-5">
            <h3 className="mb-4 border-[#e5e0d5] border-b pb-2.5 font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
              Coverage Details
            </h3>
            <div className="space-y-0 font-sans text-[13px]">
              <div className="flex justify-between border-[#f5f2ec] border-b py-2.5">
                <span className="text-[#777]">Sources</span>
                <span className="font-bold text-[#2a2520]">
                  {story.sourceCount} outlet
                  {story.sourceCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex justify-between border-[#f5f2ec] border-b py-2.5">
                <span className="text-[#777]">First reported</span>
                <span className="font-medium text-[#2a2520] text-[12px]">
                  {formatDate(story.firstReportedAt)}
                </span>
              </div>
              <div className="flex justify-between py-2.5">
                <span className="text-[#777]">Last updated</span>
                <span className="font-medium text-[#2a2520] text-[12px]">
                  {formatDate(story.updatedAt)}
                </span>
              </div>
            </div>
            {/* Source logo squares */}
            <div className="mt-4 flex gap-2">
              {articles.map((article) => {
                const badge = BADGE_COLORS[article.source.toLowerCase()];
                return (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-md font-sans font-extrabold text-[8px] text-white tracking-wide"
                    key={`logo-${article.url}`}
                    style={{
                      backgroundColor: badge?.bg ?? "#555",
                    }}
                    title={badge?.label ?? article.source}
                  >
                    {badge?.label ?? article.source}
                  </div>
                );
              })}
            </div>
          </div>

          {/* How Sources Report It */}
          {angles.length > 1 ? (
            <div className="rounded-lg border border-[#e5e0d5] p-5">
              <h3 className="mb-4 flex items-center gap-2 border-[#e5e0d5] border-b pb-2.5 font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
                How Sources Report It
                <span className="rounded bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-2 py-0.5 font-sans font-bold text-[9px] text-white normal-case tracking-wide">
                  AI
                </span>
              </h3>
              <div className="space-y-0">
                {angles.map((a) => (
                  <div
                    className="border-[#f5f2ec] border-b py-3 last:border-0"
                    key={a.source}
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <SourceBadge source={a.source} />
                      <AngleTag angle={a.angle} />
                    </div>
                    <p className="font-sans text-[12.5px] text-[#666] leading-[1.6]">
                      {a.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Related Metrics */}
          {relatedMetrics.length > 0 ? (
            <div className="rounded-lg border border-[#e5e0d5] p-5">
              <h3 className="mb-4 border-[#e5e0d5] border-b pb-2.5 font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
                Related Metrics
              </h3>
              <div className="space-y-0">
                {relatedMetrics.map((m) => (
                  <div
                    className="flex items-center gap-3 border-[#f5f2ec] border-b py-3 last:border-0"
                    key={m.metric}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-sans text-[11px] text-[#998] uppercase tracking-wide">
                        {m.label}
                      </p>
                      <div className="mt-0.5 flex items-baseline gap-2">
                        <span className="font-heading font-bold text-[17px] text-[#2a2520]">
                          {m.value}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-sans font-semibold text-[10px] ${
                            m.changeType === "up"
                              ? "bg-[#dcfce7] text-[#166534]"
                              : m.changeType === "down"
                                ? "bg-[#fee2e2] text-[#991b1b]"
                                : "bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                        >
                          {m.change}
                        </span>
                      </div>
                    </div>
                    <div className="w-[80px] shrink-0">
                      <Sparkline
                        color={
                          m.changeType === "up"
                            ? "#16a34a"
                            : m.changeType === "down"
                              ? "#dc2626"
                              : "#998"
                        }
                        data={m.sparklineData}
                        height={32}
                        width={80}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

import { Sparkline } from "@workspace/ui/components/sparkline";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { timeAgo } from "@/lib/data";
import { getStoryPageData } from "@/lib/queries";

// ---------- Constants ----------

const BADGE_COLORS: Record<
  string,
  { bg: string; label: string; logo: string }
> = {
  rnz: { bg: "#D42C21", label: "RNZ", logo: "/sources/rnz.svg" },
  stuff: { bg: "#6443AB", label: "Stuff", logo: "/sources/stuff.png" },
  herald: { bg: "#0D0D0D", label: "Herald", logo: "/sources/herald.svg" },
  "1news": { bg: "#00274e", label: "1News", logo: "/sources/1news.svg" },
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

function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-2 py-0.5">
      <svg
        aria-hidden="true"
        className="h-2.5 w-2.5 text-white/90"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2L13.09 8.26L18 6L14.74 10.91L21 12L14.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L9.26 13.09L3 12L9.26 10.91L6 6L10.91 8.26L12 2Z" />
      </svg>
      <span className="font-sans font-bold text-[8px] text-white tracking-wider">
        AI
      </span>
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

function ChapterCard({
  direction,
  headline,
  href,
  imageUrl,
  sourceCount,
  tags,
  updatedAt,
}: {
  direction: "parent" | "child";
  headline: string;
  href: string;
  imageUrl: string | null;
  sourceCount: number;
  tags: string[];
  updatedAt: string;
}) {
  const label = direction === "parent" ? "Continues from" : "Continued in";
  const arrow = direction === "parent" ? "←" : "→";

  return (
    <Link
      className="group grid overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-[140px_1fr]"
      href={href}
    >
      <div className="relative h-[100px] overflow-hidden sm:h-full">
        {imageUrl ? (
          <Image
            alt={headline}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            fill
            sizes="140px"
            src={imageUrl}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
            }}
          />
        )}
      </div>
      <div className="flex flex-col justify-center px-4 py-3.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="font-sans text-[10px] font-medium text-[#998] uppercase tracking-wide">
            {label}
          </span>
          {sourceCount > 1 && (
            <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans font-bold text-[8px] text-white tracking-wide">
              {sourceCount} OUTLETS
            </span>
          )}
          {tags.slice(0, 2).map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
        <h4 className="font-heading font-bold text-[15px] text-[#2a2520] leading-snug">
          {headline}
        </h4>
        <div className="mt-1.5 flex items-center gap-1.5 font-sans text-[10px] text-[#998]">
          <span>{timeAgo(updatedAt)}</span>
          <span className="text-[14px]">{arrow}</span>
        </div>
      </div>
    </Link>
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

  const {
    story,
    articles,
    summaries,
    relatedMetrics,
    parentStory,
    childStory,
  } = data;
  const tags = parseTags(story.tags);
  const angles = parseAngles(story.angles);

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
          {/* Chapter link: parent */}
          {parentStory && (
            <ChapterCard
              direction="parent"
              headline={parentStory.headline}
              href={`/news/${parentStory.id}`}
              imageUrl={parentStory.imageUrl}
              sourceCount={parentStory.sourceCount}
              tags={parseTags(parentStory.tags)}
              updatedAt={parentStory.updatedAt}
            />
          )}

          {/* Summary Timeline */}
          {summaries.length > 0 ? (
            <section>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]">
                  <svg
                    aria-hidden="true"
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
                <h2 className="font-heading font-semibold text-[11px] text-[#998] uppercase tracking-[0.15em]">
                  Story Summary
                </h2>
                <AiBadge />
              </div>

              {summaries.map((entry, i) => {
                const isLatest = i === 0;
                const sources: string[] = (() => {
                  try {
                    return JSON.parse(entry.sources) as string[];
                  } catch {
                    return [];
                  }
                })();

                return (
                  <div key={entry.id}>
                    {/* Segment divider */}
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex shrink-0 items-center gap-2">
                        {isLatest && (
                          <span className="rounded bg-[#8b5cf6]/10 px-1.5 py-0.5 font-sans font-semibold text-[9px] text-[#8b5cf6] uppercase tracking-wide">
                            Latest
                          </span>
                        )}
                        <span className="font-sans text-[11px] text-[#998]">
                          {formatDate(entry.createdAt)}
                        </span>
                        <div className="flex gap-1">
                          {sources.map((s) => {
                            const badge = BADGE_COLORS[s.toLowerCase()];
                            return badge ? (
                              <div
                                className="relative h-[18px] w-[18px] overflow-hidden rounded"
                                key={s}
                              >
                                <Image
                                  alt={badge.label}
                                  className="object-cover"
                                  fill
                                  sizes="18px"
                                  src={badge.logo}
                                />
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="h-px flex-1 bg-[#e5e0d5]" />
                    </div>

                    {/* Prose content */}
                    <div
                      className={`mb-8 font-serif leading-[1.8] ${isLatest ? "text-[15px] text-[#2a2520]" : "text-[14px] text-[#666]"}`}
                    >
                      {entry.summary.split("\n\n").map((para, j) => (
                        <p className="mb-3 last:mb-0" key={`${entry.id}-p${j}`}>
                          {para}
                        </p>
                      ))}
                    </div>
                  </div>
                );
              })}

              <p className="border-[#e5e0d5] border-t pt-3 font-sans text-[10px] text-[#bbb]">
                AI-generated summaries from source articles. Updated as new
                sources are added.
              </p>
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

          {/* Chapter link: child */}
          {childStory && (
            <ChapterCard
              direction="child"
              headline={childStory.headline}
              href={`/news/${childStory.id}`}
              imageUrl={childStory.imageUrl}
              sourceCount={childStory.sourceCount}
              tags={parseTags(childStory.tags)}
              updatedAt={childStory.updatedAt}
            />
          )}
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
            {/* Source logos */}
            <div className="mt-4 flex gap-2">
              {articles.map((article) => {
                const badge = BADGE_COLORS[article.source.toLowerCase()];
                if (!badge) {
                  return null;
                }
                return (
                  <div
                    className="relative h-10 w-10 overflow-hidden rounded-lg"
                    key={`logo-${article.url}`}
                    title={badge.label}
                  >
                    <Image
                      alt={badge.label}
                      className="object-contain"
                      fill
                      sizes="40px"
                      src={badge.logo}
                    />
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
                <AiBadge />
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

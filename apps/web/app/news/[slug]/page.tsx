import { CompactRow } from "@workspace/ui/components/compact-row";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TagPill } from "@/components/news/tag-pill";
import { timeAgo } from "@/lib/data";
import { getAllStorySlugs, getStoryPageData } from "@/lib/queries";
import { SOURCE_INFO } from "@/lib/sources";

// ---------- Constants ----------

const ANGLE_STYLES: Record<string, string> = {
  "Policy focus": "bg-[#ede9fe] text-[#6d28d9]",
  "Consumer impact": "bg-[#fef3c7] text-[#92400e]",
  "Market analysis": "bg-[#e0f2fe] text-[#0369a1]",
  "Human interest": "bg-[#fce7f3] text-[#9d174d]",
  "Data-driven": "bg-[#ecfdf5] text-[#065f46]",
  "Industry perspective": "bg-[#f5f3ff] text-[#5b21b6]",
};

const METRIC_DESCRIPTIONS: Record<string, string> = {
  ocr: "Official Cash Rate set by the RBNZ — influences mortgage and savings rates.",
  cpi: "Consumer Price Index — annual change in prices for a basket of goods.",
  gdp_growth: "Quarterly GDP growth rate — total economic output change.",
  unemployment: "Percentage of the labour force actively seeking work.",
  wage_growth: "Annual change in average hourly earnings.",
  median_income:
    "Average annual income from Stats NZ Quarterly Employment Survey.",
  house_price_median:
    "National median house price from REINZ, published monthly.",
  house_price_index: "REINZ House Price Index — tracks property value changes.",
  mortgage_floating: "Average floating mortgage rate across major NZ banks.",
  mortgage_1yr:
    "Average 1-year fixed mortgage rate, published weekly by the RBNZ.",
  mortgage_2yr: "Average 2-year fixed mortgage rate across major NZ banks.",
  nzd_usd:
    "NZ dollar against US dollar — weaker Kiwi makes imports more expensive.",
  nzd_aud: "NZ dollar against Australian dollar.",
  nzd_eur: "NZ dollar against Euro.",
  petrol_91: "Average 91 octane petrol price per litre from Gaspy.",
  petrol_95: "Average 95 octane petrol price per litre from Gaspy.",
  petrol_diesel: "Average diesel price per litre from Gaspy.",
  electricity_wholesale: "National average wholesale electricity spot price.",
  milk: "Average price of 2L standard milk across NZ supermarkets.",
  eggs: "Average price of a dozen eggs across NZ supermarkets.",
  bread: "Average price of a 600g white loaf across NZ supermarkets.",
  butter: "Average price of 500g salted butter across NZ supermarkets.",
  cheese: "Average price of 1kg mild cheddar across NZ supermarkets.",
  bananas: "Average price of bananas per kg across NZ supermarkets.",
  nzx_50: "NZX 50 Index — benchmark for the NZ share market.",
  minimum_wage: "NZ minimum wage per hour, updated annually on 1 April.",
};

const METRIC_SENTIMENT: Record<string, "up_is_good" | "down_is_good"> = {
  petrol_91: "down_is_good",
  petrol_95: "down_is_good",
  petrol_diesel: "down_is_good",
  electricity_wholesale: "down_is_good",
  milk: "down_is_good",
  eggs: "down_is_good",
  bread: "down_is_good",
  butter: "down_is_good",
  cheese: "down_is_good",
  bananas: "down_is_good",
  cpi: "down_is_good",
  unemployment: "down_is_good",
  mortgage_1yr: "down_is_good",
  mortgage_2yr: "down_is_good",
  mortgage_floating: "down_is_good",
  house_price_median: "down_is_good",
  ocr: "down_is_good",
  nzd_usd: "up_is_good",
  nzd_aud: "up_is_good",
  nzd_eur: "up_is_good",
  nzx_50: "up_is_good",
  gdp_growth: "up_is_good",
  wage_growth: "up_is_good",
  median_income: "up_is_good",
  minimum_wage: "up_is_good",
};

// ---------- Static params ----------

export const dynamicParams = true;

export async function generateStaticParams() {
  const slugs = await getAllStorySlugs();
  return slugs.map((slug) => ({ slug }));
}

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
  const badge = SOURCE_INFO[source.toLowerCase()];
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
    <>
      <style>
        {`
          @keyframes ai-liquid {
            0%   { background-position: 0% 50%; }
            25%  { background-position: 100% 30%; }
            50%  { background-position: 60% 80%; }
            75%  { background-position: 20% 40%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes ai-shimmer {
            0%   { transform: translateX(-20%); }
            100% { transform: translateX(60%); }
          }
          @keyframes ai-glow {
            0%, 100% { box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -0.5px 1px rgba(0,0,0,0.08), 0 0 3px rgba(139,92,246,0.1); }
            50% { box-shadow: inset 0 1px 1px rgba(255,255,255,0.12), inset 0 -0.5px 1px rgba(0,0,0,0.08), 0 0 8px rgba(139,92,246,0.25), 0 0 20px rgba(139,92,246,0.08); }
          }
        `}
      </style>
      <span
        className="relative inline-flex items-center overflow-hidden rounded-full px-2.5 py-0.5"
        style={{
          background:
            "linear-gradient(135deg, #5b4cdb 0%, #7c3aed 50%, #8b5cf6 100%)",
          animation: "ai-glow 4s cubic-bezier(0.4,0,0.2,1) infinite",
        }}
      >
        {/* Liquid gradient shift */}
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0) 0%, rgba(139,92,246,0.3) 20%, rgba(168,130,255,0) 40%, rgba(255,255,255,0.08) 55%, rgba(124,58,237,0.25) 70%, rgba(99,102,241,0) 90%)",
            backgroundSize: "250% 250%",
            animation: "ai-liquid 6s ease-in-out infinite",
          }}
        />
        {/* Shimmer sweep */}
        <span
          aria-hidden="true"
          className="absolute top-0 h-full"
          style={{
            left: "-120%",
            width: "240%",
            background:
              "linear-gradient(100deg, transparent 0%, transparent 40%, rgba(255,255,255,0.12) 47%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.12) 53%, transparent 60%, transparent 100%)",
            animation: "ai-shimmer 5s cubic-bezier(0.4,0,0.2,1) infinite",
          }}
        />
        {/* Glass highlight */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 rounded-b-full"
          style={{
            left: "10%",
            width: "50%",
            height: "42%",
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)",
          }}
        />
        <span
          className="relative z-10 font-sans font-bold text-[8px] text-white tracking-wider"
          style={{ textShadow: "0 0.5px 1px rgba(0,0,0,0.1)" }}
        >
          AI
        </span>
      </span>
    </>
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
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          {/* Left: headline + meta */}
          <div className="min-w-0 flex-1">
            <h1 className="text-balance font-bold font-heading text-[28px] text-[#2a2520] leading-[1.15] sm:text-[34px]">
              {story.headline}
            </h1>
            <div className="mt-3 flex items-center gap-1.5 font-sans text-[12px] text-[#998]">
              <span>First reported {timeAgo(story.firstReportedAt)}</span>
              <span className="text-[#d5d0c5]">&middot;</span>
              <span>Updated {timeAgo(story.updatedAt)}</span>
            </div>
          </div>
          {/* Right: tags + outlet count */}
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-2.5">
            {story.sourceCount > 1 && (
              <span className="rounded bg-[#2a2520] px-2.5 py-1 font-sans font-bold text-[10px] text-white tracking-wide">
                {story.sourceCount} OUTLETS
              </span>
            )}
            <div className="flex gap-1.5">
              {tags.map((tag) => (
                <TagPill key={tag} tag={tag} />
              ))}
            </div>
          </div>
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
              <div className="mb-5 flex items-center gap-2.5 border-[#e5e0d5] border-b pb-3">
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
                          <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans font-bold text-[8px] text-white uppercase tracking-wide">
                            Latest
                          </span>
                        )}
                        <span className="font-sans text-[11px] text-[#998]">
                          {formatDate(entry.createdAt)}
                        </span>
                        <div className="flex gap-1">
                          {sources.map((s) => {
                            const badge = SOURCE_INFO[s.toLowerCase()];
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
                const badge = SOURCE_INFO[article.source.toLowerCase()];
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
          {/* Coverage Details — hide when no articles are assigned */}
          {articles.length > 0 && (
            <div className="rounded-lg border border-[#e5e0d5] p-5">
              {/* Per-source rows */}
              {(() => {
                // Group articles by source, track first appearance
                const sourceMap = new Map<
                  string,
                  { count: number; earliest: string }
                >();
                for (const a of articles) {
                  const existing = sourceMap.get(a.source);
                  if (existing) {
                    existing.count++;
                    if (a.publishedAt < existing.earliest) {
                      existing.earliest = a.publishedAt;
                    }
                  } else {
                    sourceMap.set(a.source, {
                      count: 1,
                      earliest: a.publishedAt,
                    });
                  }
                }
                // Sort by earliest first
                const sources = [...sourceMap.entries()].sort((a, b) =>
                  a[1].earliest.localeCompare(b[1].earliest)
                );
                const isFirst = (src: string) => sources[0]?.[0] === src;

                return (
                  <>
                    <div>
                      {sources.map(([source, { count, earliest }], i) => {
                        const badge = SOURCE_INFO[source.toLowerCase()];
                        return (
                          <div
                            className={`flex items-center gap-2.5 px-1 py-2.5 ${i < sources.length - 1 ? "border-[#f0ecdf] border-b" : ""}`}
                            key={source}
                          >
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              {badge ? (
                                <Image
                                  alt={badge.label}
                                  className="object-contain"
                                  fill
                                  sizes="40px"
                                  src={badge.logo}
                                />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-sans font-semibold text-[12px] text-[#2a2520]">
                                {badge?.label ?? source}
                              </div>
                              <div className="font-sans text-[10px] text-[#998]">
                                {timeAgo(earliest)}
                              </div>
                            </div>
                            {isFirst(source) && (
                              <span className="rounded bg-[#e8e3d9] px-1.5 py-0.5 font-sans font-bold text-[8px] text-[#2a2520] uppercase tracking-wide">
                                First
                              </span>
                            )}
                            <span className="font-sans text-[10px] text-[#bbb]">
                              {count} {count === 1 ? "article" : "articles"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between border-[#e5e0d5] border-t pt-2.5 font-sans text-[10px] text-[#998]">
                      <span>
                        <strong className="font-semibold text-[#555]">
                          {sources.length}
                        </strong>{" "}
                        {sources.length === 1 ? "outlet" : "outlets"} ·{" "}
                        <strong className="font-semibold text-[#555]">
                          {articles.length}
                        </strong>{" "}
                        {articles.length === 1 ? "article" : "articles"}
                      </span>
                      <span>
                        First reported{" "}
                        <strong className="font-semibold text-[#555]">
                          {timeAgo(story.firstReportedAt)}
                        </strong>
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

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
            <div className="overflow-hidden rounded-lg border border-[#e8e4dc]">
              <h3 className="border-[#e8e4dc] border-b px-3.5 py-2.5 font-heading font-semibold text-[#2a2520] text-sm">
                Related Metrics
              </h3>
              <div className="flex flex-col">
                {relatedMetrics.map((m, i) => (
                  <div
                    className={`${i % 2 === 1 ? "bg-[#faf8f4]" : "bg-white"} ${i < relatedMetrics.length - 1 ? "border-[#f0ece4] border-b" : ""}`}
                    key={m.metric}
                  >
                    <CompactRow
                      change={m.change}
                      changeType={m.changeType as "up" | "down" | "neutral"}
                      description={METRIC_DESCRIPTIONS[m.metric]}
                      label={m.label}
                      sentiment={METRIC_SENTIMENT[m.metric]}
                      sparklineData={m.sparklineData}
                      value={m.value}
                    />
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

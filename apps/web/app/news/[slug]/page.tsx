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
      className="flex items-center gap-1.5 font-sans text-[12px] text-[#998]"
    >
      <Link className="hover:text-[#555] transition-colors" href="/">
        Home
      </Link>
      <span>/</span>
      <Link className="hover:text-[#555] transition-colors" href="/news">
        News
      </Link>
      <span>/</span>
      <span className="truncate max-w-[300px] text-[#555]">{headline}</span>
    </nav>
  );
}

function SourceBadge({ source }: { source: string }) {
  const badge = BADGE_COLORS[source.toLowerCase()];
  if (!badge) {
    return (
      <span className="rounded bg-[#555] px-2 py-0.5 font-sans font-semibold text-[10px] text-white">
        {source}
      </span>
    );
  }
  return (
    <span
      className="rounded px-2 py-0.5 font-sans font-semibold text-[10px] text-white"
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
      className={`rounded-full px-2.5 py-0.5 font-sans font-medium text-[10px] ${style}`}
    >
      {angle}
    </span>
  );
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="rounded bg-[#e8e3d9] px-2 py-0.5 font-sans text-[10px] text-[#555]">
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
        <div className="relative mx-6 h-[280px] overflow-hidden rounded-lg sm:h-[360px]">
          <Image
            alt={story.headline}
            className="object-cover"
            fill
            priority
            sizes="(max-width: 1200px) 100vw, 1152px"
            src={story.imageUrl}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      ) : null}

      {/* Story header */}
      <header className="px-6 pt-6 pb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
          <span className="font-sans text-[11px] text-[#998]">
            {story.sourceCount} outlet{story.sourceCount === 1 ? "" : "s"}
          </span>
        </div>
        <h1 className="text-balance font-bold font-heading text-2xl text-[#2a2520] leading-tight sm:text-3xl">
          {story.headline}
        </h1>
        <p className="mt-2 font-sans text-[13px] text-[#998]">
          First reported {timeAgo(story.firstReportedAt)} &middot; Updated{" "}
          {timeAgo(story.updatedAt)}
        </p>
      </header>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-8 px-6 lg:grid-cols-[1fr_340px]">
        {/* Main column */}
        <div className="min-w-0 space-y-8">
          {/* AI Summary */}
          {summaryBullets.length > 0 ? (
            <section className="rounded-lg border border-[#e5e0d5] bg-[#faf9f6] p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] px-2 py-0.5 font-sans font-semibold text-[10px] text-white">
                  AI
                </span>
                <h2 className="font-heading font-semibold text-[15px] text-[#2a2520]">
                  Summary
                </h2>
              </div>
              <div className="space-y-2">
                {summaryBullets.map((bullet) => (
                  <p
                    className="font-sans text-[14px] text-[#444] leading-relaxed"
                    key={bullet}
                  >
                    <span className="mr-2 text-[#998]">&bull;</span>
                    {bullet}
                  </p>
                ))}
              </div>
              <p className="mt-3 font-sans text-[10px] text-[#bbb] italic">
                This summary was generated by AI and may contain inaccuracies.
              </p>
            </section>
          ) : null}

          {/* Source Coverage */}
          <section>
            <h2 className="mb-4 font-heading font-semibold text-[17px] text-[#2a2520]">
              Source Coverage
            </h2>
            <div className="space-y-4">
              {articles.map((article) => {
                const articleAngle = getAngleForSource(angles, article.source);
                return (
                  <a
                    className="group flex gap-4 overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#f5f3ee]"
                    href={article.url}
                    key={article.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {/* Thumbnail */}
                    <div className="relative hidden w-[180px] shrink-0 overflow-hidden sm:block">
                      {article.imageUrl ? (
                        <Image
                          alt={article.title}
                          className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          fill
                          sizes="180px"
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
                    <div className="flex min-w-0 flex-col justify-center py-4 pr-4 sm:py-3">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <SourceBadge source={article.source} />
                        {articleAngle ? (
                          <AngleTag angle={articleAngle.angle} />
                        ) : null}
                        <span className="font-sans text-[10px] text-[#998]">
                          {timeAgo(article.publishedAt)}
                        </span>
                      </div>
                      <h3 className="mb-1 font-heading font-semibold text-[15px] text-[#2a2520] leading-snug group-hover:underline">
                        {article.title}
                      </h3>
                      <p className="line-clamp-2 font-sans text-[13px] text-[#666] leading-relaxed">
                        {article.excerpt}
                      </p>
                      <span className="mt-2 font-sans font-medium text-[12px] text-[#0054A6]">
                        Read on{" "}
                        {BADGE_COLORS[article.source.toLowerCase()]?.label ??
                          article.source}{" "}
                        &rarr;
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Coverage Details */}
          <div className="rounded-lg border border-[#e5e0d5] p-4">
            <h3 className="mb-3 font-heading font-semibold text-[14px] text-[#2a2520]">
              Coverage Details
            </h3>
            <div className="space-y-2 font-sans text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#998]">Sources</span>
                <span className="font-medium text-[#2a2520]">
                  {story.sourceCount} outlet
                  {story.sourceCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#998]">First reported</span>
                <span className="font-medium text-[#2a2520]">
                  {formatDate(story.firstReportedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#998]">Last updated</span>
                <span className="font-medium text-[#2a2520]">
                  {formatDate(story.updatedAt)}
                </span>
              </div>
            </div>
            {/* Source logo squares */}
            <div className="mt-3 flex gap-2">
              {articles.map((article) => {
                const badge = BADGE_COLORS[article.source.toLowerCase()];
                return (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded font-sans font-bold text-[9px] text-white"
                    key={`logo-${article.url}`}
                    style={{
                      backgroundColor: badge?.bg ?? "#555",
                    }}
                    title={badge?.label ?? article.source}
                  >
                    {(badge?.label ?? article.source).slice(0, 2).toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* How Sources Report It */}
          {angles.length > 1 ? (
            <div className="rounded-lg border border-[#e5e0d5] p-4">
              <h3 className="mb-3 font-heading font-semibold text-[14px] text-[#2a2520]">
                How Sources Report It
              </h3>
              <div className="space-y-3">
                {angles.map((a) => (
                  <div key={a.source}>
                    <div className="mb-1 flex items-center gap-2">
                      <SourceBadge source={a.source} />
                      <AngleTag angle={a.angle} />
                    </div>
                    <p className="font-sans text-[12px] text-[#666] leading-relaxed">
                      {a.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Related Metrics */}
          {relatedMetrics.length > 0 ? (
            <div className="rounded-lg border border-[#e5e0d5] p-4">
              <h3 className="mb-3 font-heading font-semibold text-[14px] text-[#2a2520]">
                Related Metrics
              </h3>
              <div className="space-y-3">
                {relatedMetrics.map((m) => (
                  <div className="flex items-center gap-3" key={m.metric}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-sans text-[12px] text-[#998]">
                        {m.label}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className="font-heading font-semibold text-[16px] text-[#2a2520]">
                          {m.value}
                        </span>
                        <span
                          className={`font-sans font-medium text-[11px] ${
                            m.changeType === "up"
                              ? "text-[#16a34a]"
                              : m.changeType === "down"
                                ? "text-[#dc2626]"
                                : "text-[#998]"
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

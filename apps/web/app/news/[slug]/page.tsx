import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleCard } from "@/components/news/article-card";
import { ChapterCard } from "@/components/news/chapter-card";
import { StorySidebar } from "@/components/news/story-sidebar";
import { SummaryTimeline } from "@/components/news/summary-timeline";
import { TagPill } from "@/components/news/tag-pill";
import { timeAgo } from "@/lib/data";
import { getAngleForSource, parseAngles, parseTags } from "@/lib/news-utils";
import { getAllStorySlugs, getStoryPageData } from "@/lib/queries";

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

          <SummaryTimeline summaries={summaries} />

          {/* Source Coverage */}
          <section>
            <div className="mb-5 border-[#e5e0d5] border-b pb-3">
              <h2 className="font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
                Source Coverage
              </h2>
            </div>
            <div className="space-y-3">
              {articles.map((article, i) => (
                <ArticleCard
                  angle={getAngleForSource(angles, article.source)}
                  article={article}
                  compact={i >= 5}
                  key={article.url}
                />
              ))}
            </div>
          </section>

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

        <StorySidebar
          angles={angles}
          articles={articles}
          firstReportedAt={story.firstReportedAt}
          relatedMetrics={relatedMetrics}
        />
      </div>
    </article>
  );
}

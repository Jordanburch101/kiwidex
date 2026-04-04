import Image from "next/image";
import Link from "next/link";
import { SourceLogos } from "@/components/news/source-logos";
import { TagPill } from "@/components/news/tag-pill";
import { parseTags } from "@/lib/news-utils";
import { showFirstReported, timeAgo } from "@/lib/time";

interface StoryCardStory {
  firstReportedAt: string;
  headline: string;
  id: string;
  imageUrl: string | null;
  sources: string | null;
  tags: string;
  updatedAt: string;
}

export function StoryCard({
  story,
  variant,
}: {
  story: StoryCardStory;
  variant: "lead" | "grid";
}) {
  const tags = parseTags(story.tags);

  if (variant === "lead") {
    return (
      <Link
        className="group grid grid-cols-1 overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-2"
        href={`/news/${story.id}`}
      >
        <div className="relative h-[200px] overflow-hidden sm:h-[240px]">
          {story.imageUrl ? (
            <Image
              alt={story.headline}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 1200px) 50vw, 576px"
              src={story.imageUrl}
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
        <div className="flex flex-col justify-center px-7 py-6">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SourceLogos size={20} sources={story.sources} />
            {tags.slice(0, 2).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            <span className="font-sans text-[10px] text-[#998]">
              {timeAgo(story.updatedAt)}
            </span>
          </div>
          <h3 className="text-balance font-bold font-heading text-[20px] text-[#2a2520] leading-[1.25]">
            {story.headline}
          </h3>
          {showFirstReported(story.firstReportedAt, story.updatedAt) && (
            <div className="mt-3 border-[#f0ecdf] border-t pt-2">
              <span className="font-sans text-[8px] text-[#bba]">
                First reported {timeAgo(story.firstReportedAt)}
              </span>
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <Link
      className="group/card block overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3]"
      href={`/news/${story.id}`}
    >
      <div className="relative h-[120px] w-full overflow-hidden">
        {story.imageUrl ? (
          <Image
            alt={story.headline}
            className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
            fill
            sizes="(max-width: 1200px) 33vw, 370px"
            src={story.imageUrl}
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
      <div className="px-4 py-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <SourceLogos size={18} sources={story.sources} />
          {tags.slice(0, 1).map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
          <span className="font-sans text-[9px] text-[#998]">
            {timeAgo(story.updatedAt)}
          </span>
        </div>
        <h4 className="text-balance font-heading font-semibold text-[15px] text-[#2a2520] leading-snug">
          {story.headline}
        </h4>
      </div>
      {showFirstReported(story.firstReportedAt, story.updatedAt) && (
        <div className="border-[#f0ecdf] border-t px-4 pt-1.5 pb-3">
          <span className="font-sans text-[8px] text-[#bba]">
            First reported {timeAgo(story.firstReportedAt)}
          </span>
        </div>
      )}
    </Link>
  );
}

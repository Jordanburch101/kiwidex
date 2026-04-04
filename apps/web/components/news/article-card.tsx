import Image from "next/image";
import { AngleTag } from "@/components/news/angle-tag";
import { SourceBadge } from "@/components/news/source-badge";
import { timeAgo } from "@/lib/data";
import { SOURCE_INFO } from "@/lib/sources";

interface ArticleCardProps {
  angle?: { angle: string; description: string };
  article: {
    url: string;
    title: string;
    excerpt: string;
    imageUrl: string | null;
    source: string;
    publishedAt: string;
  };
  compact?: boolean;
}

export function ArticleCard({ article, angle, compact }: ArticleCardProps) {
  const badge = SOURCE_INFO[article.source.toLowerCase()];

  if (compact) {
    return (
      <a
        className="group grid grid-cols-[72px_1fr] items-center gap-3 overflow-hidden rounded-lg border border-[#e5e0d5] px-3 py-2.5 transition-colors hover:bg-[#faf8f3]"
        href={article.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative h-[50px] w-[72px] shrink-0 overflow-hidden rounded-md">
          {article.imageUrl ? (
            <Image
              alt={article.title}
              className="object-cover"
              fill
              sizes="72px"
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
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            <SourceBadge source={article.source} />
            <span className="font-sans font-semibold text-[11px] text-[#2a2520]">
              {badge?.label ?? article.source}
            </span>
            {angle ? <AngleTag angle={angle.angle} /> : null}
            <span className="ml-auto font-sans text-[10px] text-[#998]">
              {timeAgo(article.publishedAt)}
            </span>
          </div>
          <h3 className="truncate font-heading font-bold text-[13px] text-[#2a2520] leading-snug">
            {article.title}
          </h3>
        </div>
      </a>
    );
  }

  return (
    <a
      className="group grid overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-[200px_1fr]"
      href={article.url}
      rel="noopener noreferrer"
      target="_blank"
    >
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
              background: "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
            }}
          />
        )}
      </div>
      <div className="flex min-w-0 flex-col px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SourceBadge source={article.source} />
          <span className="font-sans font-semibold text-[13px] text-[#2a2520]">
            {badge?.label ?? article.source}
          </span>
          {angle ? <AngleTag angle={angle.angle} /> : null}
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
}

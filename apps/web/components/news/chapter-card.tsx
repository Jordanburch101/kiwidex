import Image from "next/image";
import Link from "next/link";
import { TagPill } from "@/components/news/tag-pill";
import { timeAgo } from "@/lib/data";

export function ChapterCard({
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

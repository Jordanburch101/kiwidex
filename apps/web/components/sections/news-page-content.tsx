"use client";

import { SectionHeader } from "@workspace/ui/components/section-header";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TagPill } from "@/components/news/tag-pill";
import { timeAgo } from "@/lib/time";

function parseTags(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

interface Story {
  headline: string;
  id: string;
  imageUrl: string | null;
  sourceCount: number;
  tags: string;
  updatedAt: string;
}

const TAGS = [
  { label: "All", value: "all" },
  { label: "Housing", value: "housing" },
  { label: "Employment", value: "employment" },
  { label: "Fuel", value: "fuel" },
  { label: "Groceries", value: "groceries" },
  { label: "Markets", value: "markets" },
  { label: "Interest Rates", value: "interest-rates" },
  { label: "Inflation", value: "inflation" },
  { label: "Currency", value: "currency" },
  { label: "Trade", value: "trade" },
  { label: "Government", value: "government" },
];

function OutletBadge({ count }: { count: number }) {
  if (count <= 1) {
    return null;
  }
  return (
    <span className="rounded bg-[#2a2520] px-2 py-0.5 font-sans font-bold text-[9px] text-white tracking-wide">
      {count} OUTLETS
    </span>
  );
}

export function NewsPageContent({ stories }: { stories: Story[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeFilter = searchParams.get("tag") ?? "all";

  function setFilter(tag: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === "all") {
      params.delete("tag");
    } else {
      params.set("tag", tag);
    }
    const qs = params.toString();
    router.replace(qs ? `/news?${qs}` : "/news", { scroll: false });
  }

  const filtered =
    activeFilter === "all"
      ? stories
      : stories.filter((s) => {
          return parseTags(s.tags).includes(activeFilter);
        });

  const lead = filtered[0];
  const rest = filtered.slice(1);

  return (
    <>
      <div className="px-6 pt-8 pb-2">
        <SectionHeader
          subtitle="NZ economy reporting from RNZ, Stuff, Herald &amp; 1News — grouped by story"
          title="In the News"
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 border-[#e5e0d5] border-b px-6 py-4">
        {TAGS.map((tag) => (
          <button
            className={`rounded-full px-3.5 py-1.5 font-sans text-[12px] font-medium transition-all ${
              activeFilter === tag.value
                ? "bg-[#2a2520] text-white"
                : "border border-[#d5d0c5] text-[#666] hover:border-[#999] hover:bg-[#f5f2ec]"
            }`}
            key={tag.value}
            onClick={() => setFilter(tag.value)}
            type="button"
          >
            {tag.label}
          </button>
        ))}
      </div>

      {lead ? (
        <>
          {/* Lead story */}
          <Link
            className="group mx-6 mt-6 grid grid-cols-1 overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-2"
            href={`/news/${lead.id}`}
          >
            <div className="relative h-[220px] overflow-hidden sm:h-[280px]">
              {lead.imageUrl ? (
                <Image
                  alt={lead.headline}
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  fill
                  sizes="(max-width: 1200px) 50vw, 576px"
                  src={lead.imageUrl}
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
                <OutletBadge count={lead.sourceCount} />
                {parseTags(lead.tags)
                  .slice(0, 2)
                  .map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                <span className="font-sans text-[10px] text-[#998]">
                  {timeAgo(lead.updatedAt)}
                </span>
              </div>
              <h3 className="text-balance font-bold font-heading text-[22px] text-[#2a2520] leading-[1.25]">
                {lead.headline}
              </h3>
            </div>
          </Link>

          {/* Story grid */}
          {rest.length > 0 && (
            <div className="mx-6 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((story) => {
                const tags = parseTags(story.tags);
                return (
                  <Link
                    className="group/card block overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3]"
                    href={`/news/${story.id}`}
                    key={story.id}
                  >
                    {story.imageUrl ? (
                      <div className="relative h-[140px] w-full overflow-hidden">
                        <Image
                          alt={story.headline}
                          className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
                          fill
                          sizes="(max-width: 1200px) 33vw, 370px"
                          src={story.imageUrl}
                        />
                      </div>
                    ) : null}
                    <div className="px-4 py-3.5">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <OutletBadge count={story.sourceCount} />
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
                  </Link>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="px-6 py-20 text-center">
          <p className="font-sans text-[14px] text-[#998]">
            No stories match this filter.
          </p>
        </div>
      )}

      <div className="py-10" />
    </>
  );
}

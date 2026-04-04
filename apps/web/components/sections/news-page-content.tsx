"use client";

import { SectionHeader } from "@workspace/ui/components/section-header";
import { useRouter, useSearchParams } from "next/navigation";
import { StoryCard } from "@/components/news/story-card";
import { parseTags } from "@/lib/news-utils";

interface Story {
  firstReportedAt: string;
  headline: string;
  id: string;
  imageUrl: string | null;
  sources: string | null;
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
          <div className="mx-6 mt-6">
            <StoryCard story={lead} variant="lead" />
          </div>

          {rest.length > 0 && (
            <div className="mx-6 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((story) => (
                <StoryCard key={story.id} story={story} variant="grid" />
              ))}
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

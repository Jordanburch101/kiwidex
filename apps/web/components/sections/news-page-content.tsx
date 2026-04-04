"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { useRouter, useSearchParams } from "next/navigation";
import { StoryCard, type StoryCardStory } from "@/components/news/story-card";
import { parseTags } from "@/lib/news-utils";

const PRIMARY_TAGS = [
  { label: "All", value: "all" },
  { label: "Housing", value: "housing" },
  { label: "Employment", value: "employment" },
  { label: "Fuel", value: "fuel" },
  { label: "Groceries", value: "groceries" },
  { label: "Markets", value: "markets" },
  { label: "Interest Rates", value: "interest-rates" },
];

const MORE_TAGS = [
  { label: "Inflation", value: "inflation" },
  { label: "Currency", value: "currency" },
  { label: "Trade", value: "trade" },
  { label: "Government", value: "government" },
];

export function NewsPageContent({ stories }: { stories: StoryCardStory[] }) {
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
      {/* Masthead header */}
      <div className="px-6 pt-8 pb-5">
        <h2 className="font-heading font-semibold text-4xl text-[#2a2520]">
          In the News
        </h2>
        <p className="mt-1.5 font-sans text-[13px] text-[#998]">
          Economy reporting from RNZ, Stuff, Herald &amp; 1News — grouped by
          story
        </p>
      </div>

      {/* Heavy rule */}
      <div className="mx-6 border-t-[2.5px] border-[#2a2520]" />

      {/* Tab navigation */}
      <nav
        aria-label="Filter stories by topic"
        className="flex flex-wrap items-stretch border-[#e5e0d5] border-b px-6"
      >
        {PRIMARY_TAGS.map((tag) => (
          <button
            aria-current={activeFilter === tag.value ? "page" : undefined}
            className={`font-sans text-[12.5px] px-4 py-2.5 transition-colors ${
              activeFilter === tag.value
                ? "font-semibold text-[#2a2520] border-b-2 border-[#2a2520] -mb-px"
                : "text-[#999] hover:text-[#666]"
            }`}
            key={tag.value}
            onClick={() => setFilter(tag.value)}
            type="button"
          >
            {tag.label}
          </button>
        ))}

        {/* More dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={`font-sans text-[12.5px] px-4 py-2.5 transition-colors ${
              MORE_TAGS.some((t) => t.value === activeFilter)
                ? "font-semibold text-[#2a2520] border-b-2 border-[#2a2520] -mb-px"
                : "text-[#999] hover:text-[#666]"
            }`}
          >
            {MORE_TAGS.find((t) => t.value === activeFilter)?.label ?? "More"} ▾
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MORE_TAGS.map((tag) => (
              <DropdownMenuItem
                key={tag.value}
                onClick={() => setFilter(tag.value)}
              >
                {tag.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>

      {lead ? (
        <>
          <div className="mx-6 mt-6">
            <StoryCard size="large" story={lead} variant="lead" />
          </div>

          {rest.length > 0 && (
            <div className="mx-6 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((story) => (
                <StoryCard
                  key={story.id}
                  size="large"
                  story={story}
                  variant="grid"
                />
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

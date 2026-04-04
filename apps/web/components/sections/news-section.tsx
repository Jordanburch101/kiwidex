import { SectionHeader } from "@workspace/ui/components/section-header";
import Link from "next/link";
import { StoryCard } from "@/components/news/story-card";
import { getNewsData } from "@/lib/queries";

export async function NewsSection() {
  const result = await getNewsData();

  if (!result) {
    return null;
  }

  const { lead, rest } = result;
  const displayRest = rest.slice(0, 6);

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ, Stuff, Herald &amp; 1News"
        title="In the News"
      />

      <StoryCard story={lead} variant="lead" />

      {displayRest.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayRest.map((story) => (
            <StoryCard key={story.id} story={story} variant="grid" />
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link
          className="inline-flex items-center gap-1 border-[#d5d0c5] border-b pb-0.5 font-sans text-[13px] text-[#666] no-underline transition-colors hover:border-[#2a2520] hover:text-[#2a2520]"
          href="/news"
        >
          View all stories
          <span className="text-[14px]">→</span>
        </Link>
      </div>
    </section>
  );
}

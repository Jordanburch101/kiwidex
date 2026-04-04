import { SectionHeader } from "@workspace/ui/components/section-header";
import Image from "next/image";
import Link from "next/link";
import { TagPill } from "@/components/news/tag-pill";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";
import { parseSources, SOURCE_INFO } from "@/lib/sources";

function parseTags(json: string): string[] {
  try {
    return JSON.parse(json) as string[];
  } catch {
    return [];
  }
}

function SourceLogos({
  sources,
  size,
}: {
  sources: string | null;
  size: number;
}) {
  const list = parseSources(sources);
  if (list.length === 0) {
    return null;
  }

  const MAX_VISIBLE = 5;
  const visible = list.slice(0, MAX_VISIBLE);
  const overflow = list.length - MAX_VISIBLE;

  return (
    <div className="flex items-center">
      {visible.map((source, idx) => {
        const info = SOURCE_INFO[source.toLowerCase()];
        if (!info) {
          return null;
        }
        return (
          <div
            className="relative overflow-hidden rounded-md border-2 border-[#fdfcf9]"
            key={source}
            style={{
              width: size,
              height: size,
              marginLeft: idx === 0 ? 0 : -6,
              zIndex: visible.length - idx,
            }}
          >
            <Image
              alt={info.label}
              className="object-cover"
              fill
              sizes={`${size}px`}
              src={info.logo}
            />
          </div>
        );
      })}
      {overflow > 0 && (
        <div
          className="flex items-center justify-center rounded-md border-2 border-[#fdfcf9] bg-[#e8e3d9] font-sans font-bold text-[#2a2520]"
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            zIndex: 0,
            fontSize: size * 0.4,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function showFirstReported(firstReported: string, updated: string): boolean {
  const diff = Math.abs(
    new Date(updated).getTime() - new Date(firstReported).getTime()
  );
  return diff > 3_600_000;
}

export async function NewsSection() {
  const result = await getNewsData();

  if (!result) {
    return null;
  }

  const { lead, rest } = result;
  const displayRest = rest.slice(0, 6);
  const leadTags = parseTags(lead.tags);

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ, Stuff, Herald &amp; 1News"
        title="In the News"
      />

      {/* Lead story — horizontal card */}
      <Link
        className="group grid grid-cols-1 overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3] sm:grid-cols-2"
        href={`/news/${lead.id}`}
      >
        <div className="relative h-[200px] overflow-hidden sm:h-[240px]">
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
            <SourceLogos size={20} sources={lead.sources} />
            {leadTags.slice(0, 2).map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            <span className="font-sans text-[10px] text-[#998]">
              {timeAgo(lead.updatedAt)}
            </span>
          </div>
          <h3 className="text-balance font-bold font-heading text-[20px] text-[#2a2520] leading-[1.25]">
            {lead.headline}
          </h3>
          {showFirstReported(lead.firstReportedAt, lead.updatedAt) && (
            <div className="mt-3 border-[#f0ecdf] border-t pt-2">
              <span className="font-sans text-[8px] text-[#bba]">
                First reported {timeAgo(lead.firstReportedAt)}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Story grid */}
      {displayRest.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayRest.map((story) => {
            const tags = parseTags(story.tags);
            return (
              <Link
                className="group/card block overflow-hidden rounded-lg border border-[#e5e0d5] transition-colors hover:bg-[#faf8f3]"
                href={`/news/${story.id}`}
                key={story.id}
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
                        background:
                          "linear-gradient(135deg, #c4bfb4, #a89f8f, #8a8070)",
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
          })}
        </div>
      )}

      {/* View all link */}
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

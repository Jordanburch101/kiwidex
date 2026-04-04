import Image from "next/image";
import { AiBadge } from "@/components/news/ai-badge";
import { formatNewsDate } from "@/lib/news-utils";
import { SOURCE_INFO } from "@/lib/sources";

interface SummaryEntry {
  createdAt: string;
  id: number;
  sources: string;
  summary: string;
}

function parseSummaryEntry(sources: string): string[] {
  try {
    return JSON.parse(sources) as string[];
  } catch {
    return [];
  }
}

export function SummaryTimeline({ summaries }: { summaries: SummaryEntry[] }) {
  if (summaries.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-5 flex items-center gap-2.5 border-[#e5e0d5] border-b pb-3">
        <h2 className="font-heading font-semibold text-[11px] text-[#998] uppercase tracking-[0.15em]">
          Story Summary
        </h2>
        <AiBadge />
      </div>

      {summaries.map((entry, i) => {
        const isLatest = i === 0;
        const sources = parseSummaryEntry(entry.sources);

        return (
          <div key={entry.id}>
            <div className="mb-4 flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                {isLatest && (
                  <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans font-bold text-[8px] text-white uppercase tracking-wide">
                    Latest
                  </span>
                )}
                <span className="font-sans text-[11px] text-[#998]">
                  {formatNewsDate(entry.createdAt)}
                </span>
                <div className="flex gap-1">
                  {sources.map((s) => {
                    const badge = SOURCE_INFO[s.toLowerCase()];
                    return badge ? (
                      <div
                        className="relative h-[18px] w-[18px] overflow-hidden rounded"
                        key={s}
                      >
                        <Image
                          alt={badge.label}
                          className="object-cover"
                          fill
                          sizes="18px"
                          src={badge.logo}
                        />
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="h-px flex-1 bg-[#e5e0d5]" />
            </div>

            <div
              className={`mb-8 font-serif leading-[1.8] ${isLatest ? "text-[15px] text-[#2a2520]" : "text-[14px] text-[#666]"}`}
            >
              {entry.summary.split("\n\n").map((para, j) => (
                <p className="mb-3 last:mb-0" key={`${entry.id}-p${j}`}>
                  {para}
                </p>
              ))}
            </div>
          </div>
        );
      })}

      <p className="border-[#e5e0d5] border-t pt-3 font-sans text-[10px] text-[#bbb]">
        AI-generated summaries from source articles. Updated as new sources are
        added.
      </p>
    </section>
  );
}

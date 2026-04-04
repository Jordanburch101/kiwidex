import { CompactRow } from "@workspace/ui/components/compact-row";
import Image from "next/image";
import { AiBadge } from "@/components/news/ai-badge";
import { AngleTag } from "@/components/news/angle-tag";
import { SourceBadge } from "@/components/news/source-badge";
import { timeAgo } from "@/lib/data";
import { METRIC_DESCRIPTIONS, METRIC_SENTIMENT } from "@/lib/metrics-config";
import { SOURCE_INFO } from "@/lib/sources";

interface Article {
  publishedAt: string;
  source: string;
  url: string;
}

interface Angle {
  angle: string;
  description: string;
  source: string;
}

interface RelatedMetric {
  change: string;
  changeType: string;
  label: string;
  metric: string;
  sparklineData: number[];
  value: string;
}

export function StorySidebar({
  angles,
  articles,
  firstReportedAt,
  relatedMetrics,
}: {
  angles: Angle[];
  articles: Article[];
  firstReportedAt: string;
  relatedMetrics: RelatedMetric[];
}) {
  return (
    <aside className="space-y-5 py-6 lg:pl-6">
      {articles.length > 0 && (
        <div className="rounded-lg border border-[#e5e0d5] p-5">
          {(() => {
            const sourceMap = new Map<
              string,
              { count: number; earliest: string }
            >();
            for (const a of articles) {
              const existing = sourceMap.get(a.source);
              if (existing) {
                existing.count++;
                if (a.publishedAt < existing.earliest) {
                  existing.earliest = a.publishedAt;
                }
              } else {
                sourceMap.set(a.source, {
                  count: 1,
                  earliest: a.publishedAt,
                });
              }
            }
            const sources = [...sourceMap.entries()].sort((a, b) =>
              a[1].earliest.localeCompare(b[1].earliest)
            );
            const isFirst = (src: string) => sources[0]?.[0] === src;

            return (
              <>
                <div>
                  {sources.map(([source, { count, earliest }], i) => {
                    const badge = SOURCE_INFO[source.toLowerCase()];
                    return (
                      <div
                        className={`flex items-center gap-2.5 px-1 py-2.5 ${i < sources.length - 1 ? "border-[#f0ecdf] border-b" : ""}`}
                        key={source}
                      >
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                          {badge ? (
                            <Image
                              alt={badge.label}
                              className="object-contain"
                              fill
                              sizes="40px"
                              src={badge.logo}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-sans font-semibold text-[12px] text-[#2a2520]">
                            {badge?.label ?? source}
                          </div>
                          <div className="font-sans text-[10px] text-[#998]">
                            {timeAgo(earliest)}
                          </div>
                        </div>
                        {isFirst(source) && (
                          <span className="rounded bg-[#e8e3d9] px-1.5 py-0.5 font-sans font-bold text-[8px] text-[#2a2520] uppercase tracking-wide">
                            First
                          </span>
                        )}
                        <span className="font-sans text-[10px] text-[#bbb]">
                          {count} {count === 1 ? "article" : "articles"}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-[#e5e0d5] border-t pt-2.5 font-sans text-[10px] text-[#998]">
                  <span>
                    <strong className="font-semibold text-[#555]">
                      {sources.length}
                    </strong>{" "}
                    {sources.length === 1 ? "outlet" : "outlets"} ·{" "}
                    <strong className="font-semibold text-[#555]">
                      {articles.length}
                    </strong>{" "}
                    {articles.length === 1 ? "article" : "articles"}
                  </span>
                  <span>
                    First reported{" "}
                    <strong className="font-semibold text-[#555]">
                      {timeAgo(firstReportedAt)}
                    </strong>
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {angles.length > 1 ? (
        <div className="rounded-lg border border-[#e5e0d5] p-5">
          <h3 className="mb-4 flex items-center gap-2 border-[#e5e0d5] border-b pb-2.5 font-semibold font-heading text-[11px] text-[#998] uppercase tracking-[0.15em]">
            How Sources Report It
            <AiBadge />
          </h3>
          <div className="space-y-0">
            {angles.map((a) => (
              <div
                className="border-[#f5f2ec] border-b py-3 last:border-0"
                key={a.source}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <SourceBadge source={a.source} />
                  <AngleTag angle={a.angle} />
                </div>
                <p className="font-sans text-[12.5px] text-[#666] leading-[1.6]">
                  {a.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {relatedMetrics.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-[#e8e4dc]">
          <h3 className="border-[#e8e4dc] border-b px-3.5 py-2.5 font-heading font-semibold text-[#2a2520] text-sm">
            Related Metrics
          </h3>
          <div className="flex flex-col">
            {relatedMetrics.map((m, i) => (
              <div
                className={`${i % 2 === 1 ? "bg-[#faf8f4]" : "bg-white"} ${i < relatedMetrics.length - 1 ? "border-[#f0ece4] border-b" : ""}`}
                key={m.metric}
              >
                <CompactRow
                  change={m.change}
                  changeType={m.changeType as "up" | "down" | "neutral"}
                  description={METRIC_DESCRIPTIONS[m.metric]}
                  label={m.label}
                  sentiment={METRIC_SENTIMENT[m.metric]}
                  sparklineData={m.sparklineData}
                  value={m.value}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

import { SectionHeader } from "@workspace/ui/components/section-header";
import Image from "next/image";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";
import { pickLeadAndRest } from "@/lib/score-articles";

const BADGE_COLORS: Record<string, { bg: string; label: string }> = {
  rnz: { bg: "#D42C21", label: "RNZ" },
  stuff: { bg: "#0054A6", label: "Stuff" },
  herald: { bg: "#0D0D0D", label: "Herald" },
  interest: { bg: "#1a6b3c", label: "Interest" },
};

function SourceBadge({ source }: { source: string }) {
  const config = BADGE_COLORS[source] ?? { bg: "#666", label: source };
  return (
    <span
      className="rounded px-1.5 py-0.5 font-sans font-semibold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: config.bg }}
    >
      {config.label}
    </span>
  );
}

export async function NewsSection() {
  const articles = await getNewsData();
  const result = pickLeadAndRest(articles);

  if (!result) {
    return null;
  }

  const { lead, rest } = result;
  const displayRest = rest.slice(0, 6);

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ, Stuff, Herald &amp; Interest"
        title="In the News"
      />

      {/* Lead story — horizontal card (image left, text right) */}
      <a
        className="group grid grid-cols-2 overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
        href={lead.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative h-[240px] overflow-hidden">
          {lead.imageUrl ? (
            <Image
              alt={lead.title}
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
          <div className="mb-2 flex items-center gap-2">
            <SourceBadge source={lead.source} />
            <span className="font-sans text-[#998] text-[11px]">
              {timeAgo(lead.publishedAt)}
            </span>
          </div>
          <h3 className="text-balance font-bold font-heading text-[#2a2520] text-xl leading-tight">
            {lead.title}
          </h3>
          {lead.excerpt && (
            <p className="mt-3 text-[#5a5550] text-[13.5px] leading-[1.7]">
              {lead.excerpt}
            </p>
          )}
        </div>
      </a>

      {/* 6 small image cards — 2 rows of 3 */}
      {displayRest.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {displayRest.map((article) => (
            <a
              className="group/card block overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
              href={article.url}
              key={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="relative h-[120px] w-full overflow-hidden">
                {article.imageUrl ? (
                  <Image
                    alt={article.title}
                    className="object-cover transition-transform duration-300 group-hover/card:scale-[1.02]"
                    fill
                    sizes="(max-width: 1200px) 33vw, 370px"
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
              <div className="px-3 py-3">
                <div className="mb-1 flex items-center gap-1.5">
                  <SourceBadge source={article.source} />
                  <span className="font-sans text-[#998] text-[9px]">
                    {timeAgo(article.publishedAt)}
                  </span>
                </div>
                <h4 className="text-balance font-heading font-semibold text-[#2a2520] text-[15px] leading-snug">
                  {article.title}
                </h4>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

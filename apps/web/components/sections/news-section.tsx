import Image from "next/image";
import { SectionHeader } from "@workspace/ui/components/section-header";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";

function SourceBadge({
  source,
  variant,
}: {
  source: string;
  variant: "dark" | "light";
}) {
  if (variant === "dark") {
    return (
      <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans font-semibold text-[#faf9f6] text-[9px] tracking-wide">
        {source === "rnz" ? "RNZ" : "Stuff"}
      </span>
    );
  }
  return (
    <span className="rounded bg-[#e8e3d8] px-1.5 py-0.5 font-medium font-sans text-[#5a5550] text-[9px]">
      {source === "rnz" ? "RNZ" : "Stuff"}
    </span>
  );
}

export async function NewsSection() {
  const articles = await getNewsData();

  if (articles.length === 0) {
    return null;
  }

  const [lead, ...rest] = articles;

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ &amp; Stuff"
        title="In the News"
      />

      {/* Lead story — horizontal card (image left, text right) */}
      <a
        className="group flex overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
        href={lead!.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative w-[280px] flex-shrink-0 overflow-hidden">
          {lead!.imageUrl ? (
            <Image
              alt={lead!.title}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="280px"
              src={lead!.imageUrl}
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
        <div className="flex flex-col justify-center px-5 py-4">
          <div className="mb-1.5 flex items-center gap-2">
            <SourceBadge source={lead!.source} variant="dark" />
            <span className="font-sans text-[10px] text-[#998]">
              {timeAgo(lead!.publishedAt)}
            </span>
          </div>
          <h3 className="font-bold font-heading text-[#2a2520] text-lg leading-tight">
            {lead!.title}
          </h3>
          {lead!.excerpt && (
            <p className="mt-1.5 text-[12px] text-[#5a5550] leading-relaxed">
              {lead!.excerpt}
            </p>
          )}
        </div>
      </a>

      {/* 3 small image cards below */}
      {rest.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {rest.map((article) => (
            <a
              className="group/card block overflow-hidden rounded border border-[#e5e0d5] transition-colors hover:bg-[#f0ecdf]"
              href={article.url}
              key={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="relative h-[100px] w-full overflow-hidden">
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
                  <SourceBadge source={article.source} variant="light" />
                  <span className="font-sans text-[#998] text-[9px]">
                    {timeAgo(article.publishedAt)}
                  </span>
                </div>
                <h4 className="font-heading font-semibold text-[#2a2520] text-[13px] leading-snug">
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

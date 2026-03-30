import { SectionHeader } from "@workspace/ui/components/section-header";
import Image from "next/image";
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

  const [hero, ...rest] = articles;

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Economy reporting from RNZ &amp; Stuff"
        title="In the News"
      />

      {/* Lead story — side-by-side */}
      <a
        className="group flex gap-5 py-3 transition-colors hover:bg-[#f0ecdf] rounded px-1 -mx-1"
        href={hero!.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <SourceBadge source={hero!.source} variant="dark" />
            <span className="font-sans text-[10px] text-[#998]">
              {timeAgo(hero!.publishedAt)}
            </span>
          </div>
          <h3 className="font-bold font-heading text-[#2a2520] text-lg leading-tight">
            {hero!.title}
          </h3>
          {hero!.excerpt && (
            <p className="mt-2 text-[13px] text-[#5a5550] leading-relaxed">
              {hero!.excerpt}
            </p>
          )}
        </div>
        {hero!.imageUrl && (
          <div className="relative h-[120px] w-[160px] flex-shrink-0 overflow-hidden rounded">
            <Image
              alt={hero!.title}
              className="object-cover"
              fill
              sizes="160px"
              src={hero!.imageUrl}
            />
          </div>
        )}
      </a>

      {/* Bottom row */}
      {rest.length > 0 && (
        <div className="grid grid-cols-3 border-[#e5e0d5] border-t mt-3">
          {rest.map((article, i) => (
            <a
              className={`block px-4 py-4 transition-colors hover:bg-[#f0ecdf] ${
                i < rest.length - 1 ? "border-[#e5e0d5] border-r" : ""
              }`}
              href={article.url}
              key={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <SourceBadge source={article.source} variant="light" />
                <span className="font-sans text-[#998] text-[9px]">
                  {timeAgo(article.publishedAt)}
                </span>
              </div>
              <h4 className="font-heading font-semibold text-[#2a2520] text-[13px] leading-snug">
                {article.title}
              </h4>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

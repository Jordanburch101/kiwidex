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
      <span className="rounded bg-[#2a2520] px-1.5 py-0.5 font-sans text-[9px] font-semibold tracking-wide text-[#faf9f6]">
        {source === "rnz" ? "RNZ" : "Stuff"}
      </span>
    );
  }
  return (
    <span className="rounded bg-[#e8e3d8] px-1.5 py-0.5 font-sans text-[9px] font-medium text-[#5a5550]">
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

      {/* Hero card */}
      <a
        className="group relative block overflow-hidden rounded"
        href={hero!.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="relative h-[280px] w-full">
          {hero!.imageUrl ? (
            <Image
              alt={hero!.title}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              fill
              sizes="(max-width: 1200px) 100vw, 1152px"
              src={hero!.imageUrl}
            />
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(145deg, #4a4538, #3a3528, #5a5040)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 0%, rgba(42,37,32,0.7) 50%, rgba(42,37,32,0.92) 100%)",
            }}
          />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <div className="mb-2 flex items-center gap-2">
              <SourceBadge source={hero!.source} variant="dark" />
              <span className="font-sans text-[10px] text-white/50">
                {timeAgo(hero!.publishedAt)}
              </span>
            </div>
            <h3 className="font-heading text-xl font-bold leading-tight text-white">
              {hero!.title}
            </h3>
            {hero!.excerpt && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">
                {hero!.excerpt}
              </p>
            )}
          </div>
        </div>
      </a>

      {/* Bottom row */}
      {rest.length > 0 && (
        <div className="mt-0 grid grid-cols-3 border-t border-[#e5e0d5]">
          {rest.map((article, i) => (
            <a
              key={article.url}
              className={`block px-4 py-4 transition-colors hover:bg-[#f0ecdf] ${
                i < rest.length - 1 ? "border-r border-[#e5e0d5]" : ""
              }`}
              href={article.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              <div className="mb-1.5 flex items-center gap-1.5">
                <SourceBadge source={article.source} variant="light" />
                <span className="font-sans text-[9px] text-[#998]">
                  {timeAgo(article.publishedAt)}
                </span>
              </div>
              <h4 className="font-heading text-[13px] font-semibold leading-snug text-[#2a2520]">
                {article.title}
              </h4>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

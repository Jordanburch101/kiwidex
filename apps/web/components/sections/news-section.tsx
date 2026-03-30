import { SectionHeader } from "@workspace/ui/components/section-header";
import { timeAgo } from "@/lib/data";
import { getNewsData } from "@/lib/queries";

function SourceBadge({
  source,
  variant,
}: {
  source: string;
  variant: "dark" | "light" | "overlay";
}) {
  if (variant === "overlay") {
    return (
      <span className="rounded bg-white/15 px-1.5 py-0.5 font-sans font-semibold text-white/80 text-[9px] tracking-wide">
        {source === "rnz" ? "RNZ" : "Stuff"}
      </span>
    );
  }
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

      {/* Lead story — dark branded banner */}
      <a
        className="group block rounded bg-[#2a2520] px-7 py-6 transition-colors hover:bg-[#352f28]"
        href={lead!.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <SourceBadge source={lead!.source} variant="overlay" />
          <span className="font-sans text-[10px] text-white/40">
            {timeAgo(lead!.publishedAt)}
          </span>
        </div>
        <h3 className="font-bold font-heading text-[#faf9f6] text-xl leading-tight">
          {lead!.title}
        </h3>
        {lead!.excerpt && (
          <p className="mt-2 max-w-[600px] text-[13px] text-white/60 leading-relaxed">
            {lead!.excerpt}
          </p>
        )}
      </a>

      {/* Bottom row */}
      {rest.length > 0 && (
        <div className="mt-4 grid grid-cols-3 border-[#e5e0d5] border-t">
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

import { SectionHeader } from "@workspace/ui/components/section-header";
import { MarketsCharts } from "@/components/sections/markets-charts";
import { getMarketData } from "@/lib/queries";

export async function MarketsDeepDive() {
  const { nzx50, bellwethers, quotes } = await getMarketData();

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="NZX 50 index & NZ blue-chip stocks (daily)"
        title="Markets"
      />
      <MarketsCharts bellwethers={bellwethers} nzx50={nzx50} quotes={quotes} />
    </section>
  );
}

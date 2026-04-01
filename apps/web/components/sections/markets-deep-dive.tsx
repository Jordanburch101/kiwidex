import { SectionHeader } from "@workspace/ui/components/section-header";
import { MarketsCharts } from "@/components/sections/markets-charts";
import { getMarketData } from "@/lib/queries";

export async function MarketsDeepDive() {
  const { nzx50, bellwethers, quotes } = await getMarketData();

  const nzx50Quote = quotes.find((q) => q.ticker === "^NZ50");
  const latestClose = nzx50Quote?.close;
  const subtitle = latestClose
    ? `NZX 50: ${latestClose.toLocaleString("en-NZ", { maximumFractionDigits: 0 })}`
    : "NZX 50 Index & Bellwethers";

  return (
    <section className="px-6 py-10">
      <SectionHeader subtitle={subtitle} title="Markets" />
      <MarketsCharts
        bellwethers={bellwethers}
        nzx50={nzx50}
        quotes={quotes}
      />
    </section>
  );
}

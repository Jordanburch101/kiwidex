import Link from "next/link";

const TAG_DESCRIPTIONS: Record<string, string> = {
  housing: "House prices, mortgages, and property market",
  employment: "Jobs, unemployment, and wages",
  fuel: "Petrol, diesel, and energy prices",
  groceries: "Supermarket and food prices",
  currency: "NZD exchange rates",
  markets: "NZX 50 and share market",
  "interest-rates": "OCR and lending rates",
  inflation: "Consumer price index and cost of living",
  government: "Government policy and fiscal decisions",
  trade: "Imports, exports, and trade balance",
  "general-economy": "Broader economic trends",
};

export function TagPill({ tag }: { tag: string }) {
  const description = TAG_DESCRIPTIONS[tag] ?? tag;

  return (
    <Link
      className="group/tag relative rounded-full bg-[#e8e3d9] px-2 py-0.5 font-sans font-medium text-[10px] text-[#666] transition-colors hover:bg-[#ddd8cc] hover:text-[#444]"
      href={`/news?tag=${tag}`}
      title={description}
    >
      {tag}
    </Link>
  );
}

import { CurrencyDeepDive } from "@/components/sections/currency-deep-dive";
import { Footer } from "@/components/sections/footer";
import { FuelDeepDive } from "@/components/sections/fuel-deep-dive";
import { GroceryDeepDive } from "@/components/sections/grocery-deep-dive";
import { HousingDeepDive } from "@/components/sections/housing-deep-dive";
import { Intro } from "@/components/sections/intro";
import { LabourDeepDive } from "@/components/sections/labour-deep-dive";
import { Masthead } from "@/components/sections/masthead";
import { NewsSection } from "@/components/sections/news-section";
import { Overview } from "@/components/sections/overview";
import { SponsorCTA } from "@/components/sections/sponsor-cta";
import { Ticker } from "@/components/sections/ticker";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#f4f2ed]">
      <JsonLd />
      <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
        <div className="px-6 py-6">
          <Masthead />
        </div>
        <Ticker />
        <main>
          <div className="py-6">
            <Intro />
          </div>
          <div className="px-6 py-8">
            <Overview />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <NewsSection />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <GroceryDeepDive />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <FuelDeepDive />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <HousingDeepDive />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <LabourDeepDive />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <CurrencyDeepDive />
          </div>
          <div className="border-[#e5e0d5] border-t">
            <SponsorCTA />
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

const STRUCTURED_DATA = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Kiwidex",
    url: "https://kiwidex.co.nz",
    description: "Live New Zealand economic indicators dashboard",
  },
  {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "New Zealand Economic Indicators",
    description:
      "Daily-updated collection of NZ economic metrics including CPI, fuel prices, grocery prices, housing, exchange rates, and employment data.",
    url: "https://kiwidex.co.nz",
    creator: {
      "@type": "Person",
      name: "Jordan Burch",
      url: "https://jordanburch.dev",
    },
    temporalCoverage: "2020/..",
    spatialCoverage: "New Zealand",
    variableMeasured: [
      "Consumer Price Index",
      "Official Cash Rate",
      "NZD Exchange Rates",
      "Fuel Prices",
      "Grocery Prices",
      "Median House Price",
      "Mortgage Rates",
      "Unemployment Rate",
      "Wage Growth",
    ],
    license: "https://creativecommons.org/licenses/by/4.0/",
    isAccessibleForFree: true,
  },
] as const;

function JsonLd() {
  return (
    <>
      {STRUCTURED_DATA.map((data) => (
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted hardcoded JSON-LD
          dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
          key={data["@type"]}
          type="application/ld+json"
        />
      ))}
    </>
  );
}

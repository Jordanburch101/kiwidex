import { CurrencyDeepDive } from "@/components/sections/currency-deep-dive";
import { Footer } from "@/components/sections/footer";
import { FuelDeepDive } from "@/components/sections/fuel-deep-dive";
import { GroceryDeepDive } from "@/components/sections/grocery-deep-dive";
import { NewsSection } from "@/components/sections/news-section";
import { HousingDeepDive } from "@/components/sections/housing-deep-dive";
import { Intro } from "@/components/sections/intro";
import { LabourDeepDive } from "@/components/sections/labour-deep-dive";
import { Masthead } from "@/components/sections/masthead";
import { Overview } from "@/components/sections/overview";
import { SponsorCTA } from "@/components/sections/sponsor-cta";
import { Ticker } from "@/components/sections/ticker";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#f4f2ed]">
      <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
        <div className="px-6 py-6">
          <Masthead />
        </div>
        <Ticker />
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
        <Footer />
      </div>
    </div>
  );
}

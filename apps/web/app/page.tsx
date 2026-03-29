import { CurrencyDeepDive } from "@/components/sections/currency-deep-dive";
import { Footer } from "@/components/sections/footer";
import { FuelDeepDive } from "@/components/sections/fuel-deep-dive";
import { GroceryDeepDive } from "@/components/sections/grocery-deep-dive";
import { HousingDeepDive } from "@/components/sections/housing-deep-dive";
import { LabourDeepDive } from "@/components/sections/labour-deep-dive";
import { Masthead } from "@/components/sections/masthead";
import { Overview } from "@/components/sections/overview";
import { Ticker } from "@/components/sections/ticker";

export default function Page() {
  return (
    <div className="min-h-screen bg-[#f4f2ed]">
      <div className="mx-auto min-h-screen max-w-[1200px] border-[#e5e0d5] border-x bg-[#faf9f6]">
        <div className="px-6 py-6">
          <Masthead />
        </div>
        <Ticker />
        <div className="px-6 py-8">
          <Overview />
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
        <Footer />
      </div>
    </div>
  );
}

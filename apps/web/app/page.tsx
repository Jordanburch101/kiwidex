import {
  getLatestValue,
  getTimeSeries,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
import { db } from "@workspace/db/client";

import { computeChange, getOneYearAgo, getToday } from "@/lib/data";

import { CurrencySection } from "@/components/currency-section";
import { DashboardFooter } from "@/components/dashboard-footer";
import { FuelSection } from "@/components/fuel-section";
import { GrocerySection } from "@/components/grocery-section";
import { HousingSection } from "@/components/housing-section";
import { LabourSection } from "@/components/labour-section";
import { Masthead } from "@/components/masthead";
import { OverviewColumns } from "@/components/overview-columns";
import { TickerSection } from "@/components/ticker-section";

// Helper to extract sparkline values from time series
function toValues(
  series: Awaited<ReturnType<typeof getTimeSeries>>
): number[] {
  return series.map((row) => row.value);
}

// Helper to build a time series for charts
function toChartPoints(
  series: Awaited<ReturnType<typeof getTimeSeries>>
): { date: string; value: number }[] {
  return series.map((row) => ({ date: row.date, value: row.value }));
}

// Build metric card data
function buildCardData(
  metric: MetricKey,
  latest: Awaited<ReturnType<typeof getLatestValue>>,
  series: Awaited<ReturnType<typeof getTimeSeries>>,
  color: string,
  dateRange: { from: string; to: string }
) {
  const values = toValues(series);
  const firstValue = values[0];
  const currentValue = latest?.value ?? null;
  const change =
    currentValue !== null && firstValue !== undefined
      ? computeChange(currentValue, firstValue)
      : { label: "\u2014", type: "neutral" as const };

  return {
    metric,
    label: METRIC_META[metric].label,
    value: currentValue,
    change: change.label,
    changeType: change.type,
    sparklineData: values,
    color,
    dateRange,
  };
}

// Build compact row data
function buildRowData(
  metric: MetricKey,
  latest: Awaited<ReturnType<typeof getLatestValue>>,
  series: Awaited<ReturnType<typeof getTimeSeries>>
) {
  const values = toValues(series);
  const firstValue = values[0];
  const currentValue = latest?.value ?? null;
  const change =
    currentValue !== null && firstValue !== undefined
      ? computeChange(currentValue, firstValue)
      : { label: "\u2014", type: "neutral" as const };

  return {
    metric,
    label: METRIC_META[metric].label,
    value: currentValue,
    change: change.label,
    changeType: change.type,
    sparklineData: values,
  };
}

export default async function Page() {
  const from = getOneYearAgo();
  const to = getToday();
  const dateRange = { from, to };

  // Fetch all latest values and time series in parallel
  const [
    // Latest values for overview
    petrol91Latest,
    milkLatest,
    housePriceLatest,
    mortgage1yrLatest,
    ocrLatest,
    cpiLatest,
    unemploymentLatest,
    gdpLatest,
    wageGrowthLatest,
    minimumWageLatest,
    // Time series for sparklines and charts
    petrol91Series,
    milkSeries,
    housePriceSeries,
    mortgage1yrSeries,
    ocrSeries,
    cpiSeries,
    unemploymentSeries,
    gdpSeries,
    wageGrowthSeries,
    minimumWageSeries,
    // Ticker items
    petrol95Latest,
    dieselLatest,
    eggsLatest,
    breadLatest,
    butterLatest,
    cheeseLatest,
    nzdUsdLatest,
    nzdAudLatest,
    nzdEurLatest,
    petrol95Series,
    dieselSeries,
    eggsSeries,
    breadSeries,
    butterSeries,
    cheeseSeries,
    nzdUsdSeries,
    nzdAudSeries,
    nzdEurSeries,
    // Deep dive additional
    mortgageFloatingSeries,
    mortgage2yrSeries,
    medianIncomeSeries,
  ] = await Promise.all([
    // Latest values
    getLatestValue(db, "petrol_91"),
    getLatestValue(db, "milk"),
    getLatestValue(db, "house_price_median"),
    getLatestValue(db, "mortgage_1yr"),
    getLatestValue(db, "ocr"),
    getLatestValue(db, "cpi"),
    getLatestValue(db, "unemployment"),
    getLatestValue(db, "gdp_growth"),
    getLatestValue(db, "wage_growth"),
    getLatestValue(db, "minimum_wage"),
    // Time series
    getTimeSeries(db, "petrol_91", from, to),
    getTimeSeries(db, "milk", from, to),
    getTimeSeries(db, "house_price_median", from, to),
    getTimeSeries(db, "mortgage_1yr", from, to),
    getTimeSeries(db, "ocr", from, to),
    getTimeSeries(db, "cpi", from, to),
    getTimeSeries(db, "unemployment", from, to),
    getTimeSeries(db, "gdp_growth", from, to),
    getTimeSeries(db, "wage_growth", from, to),
    getTimeSeries(db, "minimum_wage", from, to),
    // Ticker latest
    getLatestValue(db, "petrol_95"),
    getLatestValue(db, "petrol_diesel"),
    getLatestValue(db, "eggs"),
    getLatestValue(db, "bread"),
    getLatestValue(db, "butter"),
    getLatestValue(db, "cheese"),
    getLatestValue(db, "nzd_usd"),
    getLatestValue(db, "nzd_aud"),
    getLatestValue(db, "nzd_eur"),
    getTimeSeries(db, "petrol_95", from, to),
    getTimeSeries(db, "petrol_diesel", from, to),
    getTimeSeries(db, "eggs", from, to),
    getTimeSeries(db, "bread", from, to),
    getTimeSeries(db, "butter", from, to),
    getTimeSeries(db, "cheese", from, to),
    getTimeSeries(db, "nzd_usd", from, to),
    getTimeSeries(db, "nzd_aud", from, to),
    getTimeSeries(db, "nzd_eur", from, to),
    // Deep dive mortgage
    getTimeSeries(db, "mortgage_floating", from, to),
    getTimeSeries(db, "mortgage_2yr", from, to),
    getTimeSeries(db, "median_income", from, to),
  ]);

  // Build ticker data
  const tickerItems = [
    {
      metric: "petrol_91" as MetricKey,
      label: "91",
      value: petrol91Latest?.value ?? null,
      sparklineData: toValues(petrol91Series),
      color: "#c44",
    },
    {
      metric: "petrol_95" as MetricKey,
      label: "95",
      value: petrol95Latest?.value ?? null,
      sparklineData: toValues(petrol95Series),
      color: "#e68a00",
    },
    {
      metric: "petrol_diesel" as MetricKey,
      label: "Diesel",
      value: dieselLatest?.value ?? null,
      sparklineData: toValues(dieselSeries),
      color: "#3a8a3a",
    },
    {
      metric: "milk" as MetricKey,
      label: "Milk",
      value: milkLatest?.value ?? null,
      sparklineData: toValues(milkSeries),
    },
    {
      metric: "eggs" as MetricKey,
      label: "Eggs",
      value: eggsLatest?.value ?? null,
      sparklineData: toValues(eggsSeries),
    },
    {
      metric: "bread" as MetricKey,
      label: "Bread",
      value: breadLatest?.value ?? null,
      sparklineData: toValues(breadSeries),
    },
    {
      metric: "butter" as MetricKey,
      label: "Butter",
      value: butterLatest?.value ?? null,
      sparklineData: toValues(butterSeries),
    },
    {
      metric: "cheese" as MetricKey,
      label: "Cheese",
      value: cheeseLatest?.value ?? null,
      sparklineData: toValues(cheeseSeries),
    },
    {
      metric: "nzd_usd" as MetricKey,
      label: "NZD/USD",
      value: nzdUsdLatest?.value ?? null,
      sparklineData: toValues(nzdUsdSeries),
      color: "#c44",
    },
    {
      metric: "nzd_aud" as MetricKey,
      label: "NZD/AUD",
      value: nzdAudLatest?.value ?? null,
      sparklineData: toValues(nzdAudSeries),
      color: "#3a8a3a",
    },
    {
      metric: "nzd_eur" as MetricKey,
      label: "NZD/EUR",
      value: nzdEurLatest?.value ?? null,
      sparklineData: toValues(nzdEurSeries),
      color: "#e68a00",
    },
  ];

  // Build overview data
  const fuelGroceries = [
    buildCardData("petrol_91", petrol91Latest, petrol91Series, "#c44", dateRange),
    buildCardData("milk", milkLatest, milkSeries, "oklch(0.845 0.143 164.978)", dateRange),
  ];

  const housingRates = [
    buildCardData(
      "house_price_median",
      housePriceLatest,
      housePriceSeries,
      "oklch(0.508 0.118 165.612)",
      dateRange
    ),
    buildCardData(
      "mortgage_1yr",
      mortgage1yrLatest,
      mortgage1yrSeries,
      "#e68a00",
      dateRange
    ),
  ];

  const economyRows = [
    buildRowData("ocr", ocrLatest, ocrSeries),
    buildRowData("cpi", cpiLatest, cpiSeries),
    buildRowData("unemployment", unemploymentLatest, unemploymentSeries),
    buildRowData("gdp_growth", gdpLatest, gdpSeries),
    buildRowData("wage_growth", wageGrowthLatest, wageGrowthSeries),
    buildRowData("minimum_wage", minimumWageLatest, minimumWageSeries),
  ];

  return (
    <div className="min-h-screen bg-[#faf9f6]">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="py-6">
          <Masthead />
        </div>
      </div>

      <TickerSection items={tickerItems} />

      <div className="mx-auto max-w-[1200px] px-6">
        <section className="py-10">
          <OverviewColumns
            fuelGroceries={fuelGroceries}
            housingRates={housingRates}
            economyRows={economyRows}
          />
        </section>

        <div className="border-t border-[#e5e0d5]">
          <GrocerySection
            milk={toChartPoints(milkSeries)}
            eggs={toChartPoints(eggsSeries)}
            bread={toChartPoints(breadSeries)}
            butter={toChartPoints(butterSeries)}
            cheese={toChartPoints(cheeseSeries)}
          />
        </div>

        <div className="border-t border-[#e5e0d5]">
          <FuelSection
            petrol91={toChartPoints(petrol91Series)}
            petrol95={toChartPoints(petrol95Series)}
            diesel={toChartPoints(dieselSeries)}
          />
        </div>

        <div className="border-t border-[#e5e0d5]">
          <HousingSection
            housePrice={toChartPoints(housePriceSeries)}
            mortgageFloating={toChartPoints(mortgageFloatingSeries)}
            mortgage1yr={toChartPoints(mortgage1yrSeries)}
            mortgage2yr={toChartPoints(mortgage2yrSeries)}
          />
        </div>

        <div className="border-t border-[#e5e0d5]">
          <LabourSection
            unemployment={toChartPoints(unemploymentSeries)}
            wageGrowth={toChartPoints(wageGrowthSeries)}
            cpi={toChartPoints(cpiSeries)}
            medianIncome={toChartPoints(medianIncomeSeries)}
          />
        </div>

        <div className="border-t border-[#e5e0d5]">
          <CurrencySection
            nzdUsd={toChartPoints(nzdUsdSeries)}
            nzdAud={toChartPoints(nzdAudSeries)}
            nzdEur={toChartPoints(nzdEurSeries)}
          />
        </div>

        <DashboardFooter />
      </div>
    </div>
  );
}

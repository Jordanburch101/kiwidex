import {
  getLatestArticles,
  getLatestValue,
  getTimeSeries,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
import { db } from "@workspace/db/client";

import {
  computeChange,
  formatValue,
  getOneYearAgo,
  getToday,
} from "@/lib/data";

// ---------- Helpers ----------

function toValues(series: Awaited<ReturnType<typeof getTimeSeries>>): number[] {
  return series.map((row) => row.value);
}

function toChartPoints(
  series: Awaited<ReturnType<typeof getTimeSeries>>
): { date: string; value: number }[] {
  return series.map((row) => ({ date: row.date, value: row.value }));
}

/**
 * Pick the right comparison period based on data frequency.
 * Daily data (fuel, FX, groceries): 30 days
 * Monthly data (mortgage, house price): 90 days
 * Quarterly data (CPI, GDP, unemployment): 365 days
 */
function getPeriodDays(metric: MetricKey): number {
  const quarterly: MetricKey[] = [
    "cpi",
    "gdp_growth",
    "unemployment",
    "wage_growth",
  ];
  const monthly: MetricKey[] = [
    "house_price_median",
    "mortgage_1yr",
    "mortgage_floating",
    "mortgage_2yr",
    "minimum_wage",
    "median_income",
  ];
  if (quarterly.includes(metric)) {
    return 365;
  }
  if (monthly.includes(metric)) {
    return 90;
  }
  return 30;
}

// ---------- Card / Row builders ----------

function buildCardData(
  metric: MetricKey,
  latest: Awaited<ReturnType<typeof getLatestValue>>,
  series: Awaited<ReturnType<typeof getTimeSeries>>,
  color: string,
  dateRange: { from: string; to: string }
) {
  const values = toValues(series);
  const currentValue = latest?.value ?? null;
  const chartPoints = toChartPoints(series);
  const change =
    chartPoints.length >= 2
      ? computeChange(chartPoints, getPeriodDays(metric))
      : { label: "\u2014", type: "neutral" as const };

  return {
    metric,
    label: METRIC_META[metric].label,
    value: currentValue === null ? "\u2014" : formatValue(metric, currentValue),
    change: change.label,
    changeType: change.type,
    sparklineData: values,
    color,
    dateRange,
  };
}

function buildRowData(
  metric: MetricKey,
  latest: Awaited<ReturnType<typeof getLatestValue>>,
  series: Awaited<ReturnType<typeof getTimeSeries>>
) {
  const values = toValues(series);
  const currentValue = latest?.value ?? null;
  const chartPoints = toChartPoints(series);
  const change =
    chartPoints.length >= 2
      ? computeChange(chartPoints, getPeriodDays(metric))
      : { label: "\u2014", type: "neutral" as const };

  return {
    metric,
    label: METRIC_META[metric].label,
    value: currentValue === null ? "\u2014" : formatValue(metric, currentValue),
    change: change.label,
    changeType: change.type,
    sparklineData: values,
  };
}

// ---------- Public query functions ----------

// Whether "up" is good or bad — used for sparkline/pill colouring
const TICKER_SENTIMENT: Partial<
  Record<MetricKey, "up_is_good" | "down_is_good">
> = {
  petrol_91: "down_is_good",
  petrol_95: "down_is_good",
  petrol_diesel: "down_is_good",
  milk: "down_is_good",
  eggs: "down_is_good",
  bread: "down_is_good",
  butter: "down_is_good",
  cheese: "down_is_good",
  nzd_usd: "up_is_good",
  nzd_aud: "up_is_good",
  nzd_eur: "up_is_good",
};

function getTrendColor(
  sparklineData: number[],
  metric: MetricKey
): string {
  if (sparklineData.length < 2) return "#998";
  const recent = sparklineData.slice(-30);
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  if (Math.abs(last - first) / Math.abs(first) < 0.005) return "#998";

  const isUp = last > first;
  const sentiment = TICKER_SENTIMENT[metric];
  if (!sentiment) return "#998";

  const isGood =
    sentiment === "up_is_good" ? isUp : !isUp;

  return isGood ? "#3a8a3a" : "#c44";
}

export async function getTickerData() {
  const from = getOneYearAgo();
  const to = getToday();

  const tickerMetrics = [
    { metric: "petrol_91" as MetricKey, label: "91" },
    { metric: "petrol_95" as MetricKey, label: "95" },
    { metric: "petrol_diesel" as MetricKey, label: "Diesel" },
    { metric: "milk" as MetricKey, label: "Milk" },
    { metric: "eggs" as MetricKey, label: "Eggs" },
    { metric: "bread" as MetricKey, label: "Bread" },
    { metric: "butter" as MetricKey, label: "Butter" },
    { metric: "cheese" as MetricKey, label: "Cheese" },
    { metric: "nzd_usd" as MetricKey, label: "NZD/USD" },
    { metric: "nzd_aud" as MetricKey, label: "NZD/AUD" },
    { metric: "nzd_eur" as MetricKey, label: "NZD/EUR" },
  ] as const;

  const results = await Promise.all(
    tickerMetrics.map(async (item) => {
      const [latest, series] = await Promise.all([
        getLatestValue(db, item.metric),
        getTimeSeries(db, item.metric, from, to),
      ]);
      const sparklineData = toValues(series);
      return {
        metric: item.metric,
        label: item.label,
        value: latest?.value ?? null,
        sparklineData,
        color: getTrendColor(sparklineData, item.metric),
      };
    })
  );

  return results;
}

export async function getOverviewData() {
  const from = getOneYearAgo();
  const to = getToday();
  const dateRange = { from, to };

  const [
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
    nzdUsdLatest,
    medianIncomeLatest,
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
    nzdUsdSeries,
    medianIncomeSeries,
  ] = await Promise.all([
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
    getLatestValue(db, "nzd_usd"),
    getLatestValue(db, "median_income"),
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
    getTimeSeries(db, "nzd_usd", from, to),
    getTimeSeries(db, "median_income", from, to),
  ]);

  const fuelGroceries = [
    buildCardData(
      "petrol_91",
      petrol91Latest,
      petrol91Series,
      "#c44",
      dateRange
    ),
    buildCardData(
      "milk",
      milkLatest,
      milkSeries,
      "oklch(0.845 0.143 164.978)",
      dateRange
    ),
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
    buildRowData("house_price_median", housePriceLatest, housePriceSeries),
    buildRowData("mortgage_1yr", mortgage1yrLatest, mortgage1yrSeries),
    buildRowData("ocr", ocrLatest, ocrSeries),
    buildRowData("cpi", cpiLatest, cpiSeries),
    buildRowData("unemployment", unemploymentLatest, unemploymentSeries),
    buildRowData("gdp_growth", gdpLatest, gdpSeries),
    buildRowData("wage_growth", wageGrowthLatest, wageGrowthSeries),
    buildRowData("nzd_usd", nzdUsdLatest, nzdUsdSeries),
    buildRowData("median_income", medianIncomeLatest, medianIncomeSeries),
  ];

  return { fuelGroceries, housingRates, economyRows };
}

// ---------- Cost of Living chart ----------

const COST_OF_LIVING_ITEMS: {
  metric: MetricKey;
  label: string;
  color: string;
  group: "fuel" | "grocery";
}[] = [
  { metric: "petrol_91", label: "Petrol 91", color: "#cc4444", group: "fuel" },
  { metric: "petrol_95", label: "Petrol 95", color: "#e06030", group: "fuel" },
  { metric: "petrol_diesel", label: "Diesel", color: "#996633", group: "fuel" },
  { metric: "milk", label: "Milk 2L", color: "#5599aa", group: "grocery" },
  { metric: "eggs", label: "Eggs", color: "#e68a00", group: "grocery" },
  { metric: "bread", label: "Bread", color: "#3a8a3a", group: "grocery" },
  { metric: "butter", label: "Butter", color: "#aa8855", group: "grocery" },
  { metric: "cheese", label: "Cheese", color: "#8855aa", group: "grocery" },
  { metric: "bananas", label: "Bananas", color: "#d4a017", group: "grocery" },
];

export async function getCostOfLivingData() {
  const from = getOneYearAgo();
  const to = getToday();

  const seriesList = await Promise.all(
    COST_OF_LIVING_ITEMS.map(async (item) => {
      const series = await getTimeSeries(db, item.metric, from, to);
      return {
        key: item.metric,
        label: item.label,
        unit: METRIC_META[item.metric].unit,
        color: item.color,
        group: item.group,
        data: toChartPoints(series),
      };
    })
  );

  return seriesList;
}

export async function getIntroData() {
  const from = getOneYearAgo();
  const to = getToday();

  const metrics: MetricKey[] = [
    "cpi",
    "unemployment",
    "petrol_91",
    "nzd_usd",
    "wage_growth",
  ];

  const [latests, allSeries] = await Promise.all([
    Promise.all(metrics.map((m) => getLatestValue(db, m))),
    Promise.all(metrics.map((m) => getTimeSeries(db, m, from, to))),
  ]);

  const result: Record<
    string,
    { value: string; change: string; changeType: "up" | "down" | "neutral" }
  > = {};

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i]!;
    const latest = latests[i];
    const series = allSeries[i]!;
    const chartPoints = toChartPoints(series);
    const change =
      chartPoints.length >= 2
        ? computeChange(chartPoints, getPeriodDays(metric))
        : { label: "\u2014", type: "neutral" as const };

    result[metric] = {
      value:
        latest?.value === undefined || latest?.value === null
          ? "\u2014"
          : formatValue(metric, latest.value),
      change: change.label,
      changeType: change.type,
    };
  }

  return result;
}

export async function getGroceryChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [milk, eggs, bread, butter, cheese, bananas] = await Promise.all([
    getTimeSeries(db, "milk", from, to),
    getTimeSeries(db, "eggs", from, to),
    getTimeSeries(db, "bread", from, to),
    getTimeSeries(db, "butter", from, to),
    getTimeSeries(db, "cheese", from, to),
    getTimeSeries(db, "bananas", from, to),
  ]);

  return {
    milk: toChartPoints(milk),
    eggs: toChartPoints(eggs),
    bread: toChartPoints(bread),
    butter: toChartPoints(butter),
    cheese: toChartPoints(cheese),
    bananas: toChartPoints(bananas),
  };
}

export async function getFuelChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [petrol91, petrol95, diesel] = await Promise.all([
    getTimeSeries(db, "petrol_91", from, to),
    getTimeSeries(db, "petrol_95", from, to),
    getTimeSeries(db, "petrol_diesel", from, to),
  ]);

  return {
    petrol91: toChartPoints(petrol91),
    petrol95: toChartPoints(petrol95),
    diesel: toChartPoints(diesel),
  };
}

export async function getHousingChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [housePrice, mortgageFloating, mortgage1yr, mortgage2yr] =
    await Promise.all([
      getTimeSeries(db, "house_price_median", from, to),
      getTimeSeries(db, "mortgage_floating", from, to),
      getTimeSeries(db, "mortgage_1yr", from, to),
      getTimeSeries(db, "mortgage_2yr", from, to),
    ]);

  return {
    housePrice: toChartPoints(housePrice),
    mortgageFloating: toChartPoints(mortgageFloating),
    mortgage1yr: toChartPoints(mortgage1yr),
    mortgage2yr: toChartPoints(mortgage2yr),
  };
}

export async function getLabourChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [unemployment, wageGrowth, cpi, medianIncome] = await Promise.all([
    getTimeSeries(db, "unemployment", from, to),
    getTimeSeries(db, "wage_growth", from, to),
    getTimeSeries(db, "cpi", from, to),
    getTimeSeries(db, "median_income", from, to),
  ]);

  return {
    unemployment: toChartPoints(unemployment),
    wageGrowth: toChartPoints(wageGrowth),
    cpi: toChartPoints(cpi),
    medianIncome: toChartPoints(medianIncome),
  };
}

export async function getCurrencyChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [nzdUsd, nzdAud, nzdEur] = await Promise.all([
    getTimeSeries(db, "nzd_usd", from, to),
    getTimeSeries(db, "nzd_aud", from, to),
    getTimeSeries(db, "nzd_eur", from, to),
  ]);

  return {
    nzdUsd: toChartPoints(nzdUsd),
    nzdAud: toChartPoints(nzdAud),
    nzdEur: toChartPoints(nzdEur),
  };
}

export async function getNewsData() {
  return getLatestArticles(db, 2);
}

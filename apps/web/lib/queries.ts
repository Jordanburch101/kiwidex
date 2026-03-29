import {
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

export async function getTickerData() {
  const from = getOneYearAgo();
  const to = getToday();

  const tickerMetrics = [
    { metric: "petrol_91" as MetricKey, label: "91", color: "#c44" },
    { metric: "petrol_95" as MetricKey, label: "95", color: "#e68a00" },
    { metric: "petrol_diesel" as MetricKey, label: "Diesel", color: "#3a8a3a" },
    { metric: "milk" as MetricKey, label: "Milk" },
    { metric: "eggs" as MetricKey, label: "Eggs" },
    { metric: "bread" as MetricKey, label: "Bread" },
    { metric: "butter" as MetricKey, label: "Butter" },
    { metric: "cheese" as MetricKey, label: "Cheese" },
    { metric: "nzd_usd" as MetricKey, label: "NZD/USD", color: "#c44" },
    { metric: "nzd_aud" as MetricKey, label: "NZD/AUD", color: "#3a8a3a" },
    { metric: "nzd_eur" as MetricKey, label: "NZD/EUR", color: "#e68a00" },
  ] as const;

  const results = await Promise.all(
    tickerMetrics.map(async (item) => {
      const [latest, series] = await Promise.all([
        getLatestValue(db, item.metric),
        getTimeSeries(db, item.metric, from, to),
      ]);
      return {
        metric: item.metric,
        label: item.label,
        value: latest?.value ?? null,
        sparklineData: toValues(series),
        color: "color" in item ? item.color : undefined,
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
    buildRowData("ocr", ocrLatest, ocrSeries),
    buildRowData("cpi", cpiLatest, cpiSeries),
    buildRowData("unemployment", unemploymentLatest, unemploymentSeries),
    buildRowData("gdp_growth", gdpLatest, gdpSeries),
    buildRowData("wage_growth", wageGrowthLatest, wageGrowthSeries),
    buildRowData("minimum_wage", minimumWageLatest, minimumWageSeries),
  ];

  return { fuelGroceries, housingRates, economyRows };
}

// ---------- Cost of Living chart ----------

const COST_OF_LIVING_ITEMS: {
  metric: MetricKey;
  label: string;
  color: string;
}[] = [
  { metric: "petrol_91", label: "Petrol 91", color: "#cc4444" },
  { metric: "milk", label: "Milk 2L", color: "#5599aa" },
  { metric: "eggs", label: "Eggs", color: "#e68a00" },
  { metric: "bread", label: "Bread", color: "#3a8a3a" },
  { metric: "butter", label: "Butter", color: "#aa8855" },
  { metric: "cheese", label: "Cheese", color: "#8855aa" },
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
        data: toChartPoints(series),
      };
    })
  );

  return seriesList;
}

export async function getGroceryChartData() {
  const from = getOneYearAgo();
  const to = getToday();

  const [milk, eggs, bread, butter, cheese] = await Promise.all([
    getTimeSeries(db, "milk", from, to),
    getTimeSeries(db, "eggs", from, to),
    getTimeSeries(db, "bread", from, to),
    getTimeSeries(db, "butter", from, to),
    getTimeSeries(db, "cheese", from, to),
  ]);

  return {
    milk: toChartPoints(milk),
    eggs: toChartPoints(eggs),
    bread: toChartPoints(bread),
    butter: toChartPoints(butter),
    cheese: toChartPoints(cheese),
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

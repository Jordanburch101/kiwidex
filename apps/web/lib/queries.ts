import {
  getAllLatestQuotes,
  getArticlesByStoryId,
  getChildStory,
  getLatestSummary,
  getLatestValue,
  getStockTimeSeries,
  getStories,
  getStoryBySlug,
  getStorySummaries,
  getTimeSeries,
  METRIC_META,
  type MetricKey,
} from "@workspace/db";
import { db } from "@workspace/db/client";
import { unstable_cache } from "next/cache";
import {
  DATA,
  FUEL_COLORS,
  GROCERY_COLORS,
  HOUSING_COLORS,
  INDICATOR,
} from "@/lib/colors";
import {
  computeChange,
  formatValue,
  getAllTimeStart,
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
    "house_price_index",
    "ocr",
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

  const periodDays = getPeriodDays(metric);
  return {
    metric,
    label: METRIC_META[metric].label,
    value: currentValue === null ? "\u2014" : formatValue(metric, currentValue),
    change: change.label,
    changePeriod: periodDays <= 30 ? "30d" : periodDays <= 90 ? "90d" : "1yr",
    changeType: change.type,
    sparklineData: values,
  };
}

/**
 * Build a synthetic "Groceries" row by averaging all grocery time series
 * by date, then computing a 30-day % change on that average.
 */
function buildGroceryRow(
  allSeries: Awaited<ReturnType<typeof getTimeSeries>>[]
) {
  // Group values by date and average them
  const byDate = new Map<string, number[]>();
  for (const series of allSeries) {
    for (const point of series) {
      const existing = byDate.get(point.date);
      if (existing) {
        existing.push(point.value);
      } else {
        byDate.set(point.date, [point.value]);
      }
    }
  }

  const avgSeries = [...byDate.entries()]
    .map(([date, vals]) => ({
      date,
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const currentValue =
    avgSeries.length > 0 ? avgSeries[avgSeries.length - 1]!.value : null;
  const change =
    avgSeries.length >= 2
      ? computeChange(avgSeries, 30)
      : { label: "\u2014", type: "neutral" as const };

  return {
    metric: "groceries" as const,
    label: "Groceries",
    value: currentValue === null ? "\u2014" : `$${currentValue.toFixed(2)}`,
    change: change.label,
    changePeriod: "30d",
    changeType: change.type,
    sparklineData: avgSeries.map((p) => p.value),
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
  electricity_wholesale: "down_is_good",
  milk: "down_is_good",
  eggs: "down_is_good",
  bread: "down_is_good",
  butter: "down_is_good",
  cheese: "down_is_good",
  nzd_usd: "up_is_good",
  nzd_aud: "up_is_good",
  nzd_eur: "up_is_good",
  nzx_50: "up_is_good",
};

function getTrendColor(sparklineData: number[], metric: MetricKey): string {
  if (sparklineData.length < 2) {
    return INDICATOR.neutral;
  }
  const recent = sparklineData.slice(-30);
  const first = recent[0]!;
  const last = recent.at(-1)!;
  if (Math.abs(last - first) / Math.abs(first) < 0.005) {
    return INDICATOR.neutral;
  }

  const isUp = last > first;
  const sentiment = TICKER_SENTIMENT[metric];
  if (!sentiment) {
    return INDICATOR.neutral;
  }

  const isGood = sentiment === "up_is_good" ? isUp : !isUp;

  return isGood ? INDICATOR.up : INDICATOR.down;
}

async function _getTickerData() {
  const from = getOneYearAgo();
  const to = getToday();

  const tickerMetrics = [
    { metric: "petrol_91" as MetricKey, label: "91" },
    { metric: "petrol_95" as MetricKey, label: "95" },
    { metric: "petrol_diesel" as MetricKey, label: "Diesel" },
    { metric: "electricity_wholesale" as MetricKey, label: "Power" },
    { metric: "milk" as MetricKey, label: "Milk" },
    { metric: "eggs" as MetricKey, label: "Eggs" },
    { metric: "bread" as MetricKey, label: "Bread" },
    { metric: "butter" as MetricKey, label: "Butter" },
    { metric: "cheese" as MetricKey, label: "Cheese" },
    { metric: "nzd_usd" as MetricKey, label: "NZD/USD" },
    { metric: "nzd_aud" as MetricKey, label: "NZD/AUD" },
    { metric: "nzd_eur" as MetricKey, label: "NZD/EUR" },
    { metric: "nzx_50" as MetricKey, label: "NZX 50" },
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

async function _getOverviewData() {
  const from = getOneYearAgo();
  const to = getToday();
  const dateRange = { from, to };

  const [
    petrol91Latest,
    milkLatest,
    housePriceLatest,
    mortgage1yrLatest,
    ocrLatest,
    elecWholesaleLatest,
    unemploymentLatest,
    nzx50Latest,
    _minimumWageLatest,
    nzdUsdLatest,
    medianIncomeLatest,
    eggsSeries,
    breadSeries,
    butterSeries,
    cheeseSeries,
    bananasSeries,
    petrol91Series,
    milkSeries,
    housePriceSeries,
    mortgage1yrSeries,
    ocrSeries,
    elecWholesaleSeries,
    unemploymentSeries,
    nzx50Series,
    _minimumWageSeries,
    nzdUsdSeries,
    medianIncomeSeries,
  ] = await Promise.all([
    getLatestValue(db, "petrol_91"),
    getLatestValue(db, "milk"),
    getLatestValue(db, "house_price_median"),
    getLatestValue(db, "mortgage_1yr"),
    getLatestValue(db, "ocr"),
    getLatestValue(db, "electricity_wholesale"),
    getLatestValue(db, "unemployment"),
    getLatestValue(db, "nzx_50"),
    getLatestValue(db, "minimum_wage"),
    getLatestValue(db, "nzd_usd"),
    getLatestValue(db, "median_income"),
    getTimeSeries(db, "eggs", from, to),
    getTimeSeries(db, "bread", from, to),
    getTimeSeries(db, "butter", from, to),
    getTimeSeries(db, "cheese", from, to),
    getTimeSeries(db, "bananas", from, to),
    getTimeSeries(db, "petrol_91", from, to),
    getTimeSeries(db, "milk", from, to),
    getTimeSeries(db, "house_price_median", from, to),
    getTimeSeries(db, "mortgage_1yr", from, to),
    getTimeSeries(db, "ocr", from, to),
    getTimeSeries(db, "electricity_wholesale", from, to),
    getTimeSeries(db, "unemployment", from, to),
    getTimeSeries(db, "nzx_50", from, to),
    getTimeSeries(db, "minimum_wage", from, to),
    getTimeSeries(db, "nzd_usd", from, to),
    getTimeSeries(db, "median_income", from, to),
  ]);

  const fuelGroceries = [
    buildCardData(
      "petrol_91",
      petrol91Latest,
      petrol91Series,
      FUEL_COLORS.petrol_91,
      dateRange
    ),
    buildCardData(
      "milk",
      milkLatest,
      milkSeries,
      GROCERY_COLORS.milk,
      dateRange
    ),
  ];

  const housingRates = [
    buildCardData(
      "house_price_median",
      housePriceLatest,
      housePriceSeries,
      HOUSING_COLORS.median,
      dateRange
    ),
    buildCardData(
      "mortgage_1yr",
      mortgage1yrLatest,
      mortgage1yrSeries,
      HOUSING_COLORS.oneYear,
      dateRange
    ),
  ];

  const economyRows = [
    // 30-day comparison
    buildRowData(
      "electricity_wholesale",
      elecWholesaleLatest,
      elecWholesaleSeries
    ),
    buildRowData("nzx_50", nzx50Latest, nzx50Series),
    buildRowData("nzd_usd", nzdUsdLatest, nzdUsdSeries),
    buildGroceryRow([
      milkSeries,
      eggsSeries,
      breadSeries,
      butterSeries,
      cheeseSeries,
      bananasSeries,
    ]),
    // 90-day comparison
    buildRowData("house_price_median", housePriceLatest, housePriceSeries),
    buildRowData("mortgage_1yr", mortgage1yrLatest, mortgage1yrSeries),
    // 365-day comparison
    buildRowData("ocr", ocrLatest, ocrSeries),
    buildRowData("unemployment", unemploymentLatest, unemploymentSeries),
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
  {
    metric: "petrol_91",
    label: "Petrol 91",
    color: FUEL_COLORS.petrol_91,
    group: "fuel",
  },
  {
    metric: "petrol_95",
    label: "Petrol 95",
    color: FUEL_COLORS.petrol_95,
    group: "fuel",
  },
  {
    metric: "petrol_diesel",
    label: "Diesel",
    color: FUEL_COLORS.petrol_diesel,
    group: "fuel",
  },
  {
    metric: "milk",
    label: "Milk 2L",
    color: GROCERY_COLORS.milk,
    group: "grocery",
  },
  {
    metric: "eggs",
    label: "Eggs",
    color: GROCERY_COLORS.eggs,
    group: "grocery",
  },
  {
    metric: "bread",
    label: "Bread",
    color: GROCERY_COLORS.bread,
    group: "grocery",
  },
  {
    metric: "butter",
    label: "Butter",
    color: GROCERY_COLORS.butter,
    group: "grocery",
  },
  {
    metric: "cheese",
    label: "Cheese",
    color: GROCERY_COLORS.cheese,
    group: "grocery",
  },
  {
    metric: "bananas",
    label: "Bananas",
    color: GROCERY_COLORS.bananas,
    group: "grocery",
  },
];

/**
 * 7-day rolling average to smooth volatile daily data (e.g. wholesale power).
 */
function smooth7d(
  data: { date: string; value: number }[]
): { date: string; value: number }[] {
  if (data.length < 7) {
    return data;
  }
  const result: { date: string; value: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const windowStart = Math.max(0, i - 6);
    let sum = 0;
    for (let j = windowStart; j <= i; j++) {
      sum += data[j]!.value;
    }
    result.push({
      date: data[i]!.date,
      value: sum / (i - windowStart + 1),
    });
  }
  return result;
}

const SMOOTH_METRICS = new Set<MetricKey>(["electricity_wholesale"]);

async function _getCostOfLivingData() {
  const from = getOneYearAgo();
  const to = getToday();

  const seriesList = await Promise.all(
    COST_OF_LIVING_ITEMS.map(async (item) => {
      const series = await getTimeSeries(db, item.metric, from, to);
      const points = toChartPoints(series);
      return {
        key: item.metric,
        label: item.label,
        unit: METRIC_META[item.metric].unit,
        color: item.color,
        group: item.group,
        data: SMOOTH_METRICS.has(item.metric) ? smooth7d(points) : points,
      };
    })
  );

  return seriesList;
}

/**
 * Averages multiple time series into one by date.
 */
function averageSeriesByDate(
  seriesList: { date: string; value: number }[][]
): { date: string; value: number }[] {
  const byDate = new Map<string, number[]>();
  for (const series of seriesList) {
    for (const pt of series) {
      const arr = byDate.get(pt.date);
      if (arr) {
        arr.push(pt.value);
      } else {
        byDate.set(pt.date, [pt.value]);
      }
    }
  }
  const result: { date: string; value: number }[] = [];
  for (const [date, values] of byDate) {
    result.push({
      date,
      value: values.reduce((a, b) => a + b, 0) / values.length,
    });
  }
  result.sort((a, b) => (a.date < b.date ? -1 : 1));
  return result;
}

async function _getHorizonData() {
  const from = getOneYearAgo();
  const to = getToday();

  // Fetch all individual series
  const [
    p91,
    p95,
    diesel,
    elec,
    milk,
    eggs,
    bread,
    butter,
    cheese,
    bananas,
    nzx50,
  ] = await Promise.all([
    getTimeSeries(db, "petrol_91", from, to),
    getTimeSeries(db, "petrol_95", from, to),
    getTimeSeries(db, "petrol_diesel", from, to),
    getTimeSeries(db, "electricity_wholesale", from, to),
    getTimeSeries(db, "milk", from, to),
    getTimeSeries(db, "eggs", from, to),
    getTimeSeries(db, "bread", from, to),
    getTimeSeries(db, "butter", from, to),
    getTimeSeries(db, "cheese", from, to),
    getTimeSeries(db, "bananas", from, to),
    getStockTimeSeries(db, "^NZ50", from, to),
  ]);

  return [
    {
      key: "fuel",
      label: "Fuel",
      color: DATA.burntOrange,
      data: averageSeriesByDate([
        toChartPoints(p91),
        toChartPoints(p95),
        toChartPoints(diesel),
      ]),
    },
    {
      key: "groceries",
      label: "Groceries",
      color: DATA.teal,
      data: averageSeriesByDate([
        toChartPoints(milk),
        toChartPoints(eggs),
        toChartPoints(bread),
        toChartPoints(butter),
        toChartPoints(cheese),
        toChartPoints(bananas),
      ]),
    },
    {
      key: "power",
      label: "Power",
      color: DATA.gold,
      data: smooth7d(toChartPoints(elec)),
    },
    {
      key: "nzx50",
      label: "NZX 50",
      color: DATA.blue,
      data: nzx50.map((r) => ({ date: r.date, value: r.close })),
    },
  ];
}

async function _getIntroData() {
  const row = await getLatestSummary(db);

  if (!row) {
    return { summary: null, metrics: {} as Record<string, string> };
  }

  const raw = JSON.parse(row.metrics) as Record<string, string | number>;
  const metrics: Record<string, string> = {};
  for (const [key, val] of Object.entries(raw)) {
    // New format stores raw numbers — format for display
    // Legacy format stores pre-formatted strings — pass through
    metrics[key] =
      typeof val === "number"
        ? formatValue(key as MetricKey, val)
        : String(val);
  }
  return { summary: row.content, metrics };
}

async function _getGroceryChartData() {
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

async function _getFuelChartData() {
  const from = getAllTimeStart();
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

async function _getHousingChartData() {
  const from = getAllTimeStart();
  const to = getToday();

  const [
    housePrice,
    housePriceIndex,
    mortgageFloating,
    mortgage1yr,
    mortgage2yr,
  ] = await Promise.all([
    getTimeSeries(db, "house_price_median", from, to),
    getTimeSeries(db, "house_price_index", from, to),
    getTimeSeries(db, "mortgage_floating", from, to),
    getTimeSeries(db, "mortgage_1yr", from, to),
    getTimeSeries(db, "mortgage_2yr", from, to),
  ]);

  return {
    housePrice: toChartPoints(housePrice),
    housePriceIndex: toChartPoints(housePriceIndex),
    mortgageFloating: toChartPoints(mortgageFloating),
    mortgage1yr: toChartPoints(mortgage1yr),
    mortgage2yr: toChartPoints(mortgage2yr),
  };
}

async function _getLabourChartData() {
  const from = getAllTimeStart();
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

async function _getCurrencyChartData() {
  const from = getAllTimeStart();
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

async function _getNewsData() {
  const stories = await getStories(db, { days: 7, limit: 7 });
  if (stories.length === 0) {
    return null;
  }

  return {
    lead: stories[0]!,
    rest: stories.slice(1),
  };
}

async function _getNewsPageData() {
  const stories = await getStories(db, { days: 30, limit: 50 });
  if (stories.length === 0) {
    return null;
  }

  const lead = stories[0]!;
  const rest = stories.slice(1);

  return { lead, rest };
}

async function _getStoryPageData(slug: string) {
  const story = await getStoryBySlug(db, slug);
  if (!story) {
    return null;
  }

  const articles = await getArticlesByStoryId(db, story.id);

  let relatedMetricData: {
    metric: string;
    label: string;
    value: string;
    change: string;
    changeType: string;
    sparklineData: number[];
  }[] = [];

  if (story.relatedMetrics) {
    const metricKeys: MetricKey[] = JSON.parse(story.relatedMetrics);
    const from = getOneYearAgo();
    const to = getToday();

    relatedMetricData = await Promise.all(
      metricKeys.slice(0, 5).map(async (metric) => {
        const [latest, series] = await Promise.all([
          getLatestValue(db, metric),
          getTimeSeries(db, metric, from, to),
        ]);
        const values = toValues(series);
        const chartPoints = toChartPoints(series);
        const change =
          chartPoints.length >= 2
            ? computeChange(chartPoints, getPeriodDays(metric))
            : { label: "\u2014", type: "neutral" as const };

        return {
          metric,
          label: METRIC_META[metric].label,
          value:
            latest?.value === undefined || latest?.value === null
              ? "\u2014"
              : formatValue(metric, latest.value),
          change: change.label,
          changeType: change.type,
          sparklineData: values,
        };
      })
    );
  }

  // Fetch summary timeline
  const summaries = await getStorySummaries(db, story.id);

  // Chapter links
  type ChapterLink = {
    id: string;
    headline: string;
    imageUrl: string | null;
    sourceCount: number;
    tags: string;
    updatedAt: string;
  } | null;

  let parentStory: ChapterLink = null;
  let childStory: ChapterLink = null;

  if (story.parentStoryId) {
    const parent = await getStoryBySlug(db, story.parentStoryId);
    if (parent) {
      parentStory = {
        id: parent.id,
        headline: parent.headline,
        imageUrl: parent.imageUrl,
        sourceCount: parent.sourceCount,
        tags: parent.tags,
        updatedAt: parent.updatedAt,
      };
    }
  }

  const child = await getChildStory(db, story.id);
  if (child) {
    childStory = {
      id: child.id,
      headline: child.headline,
      imageUrl: child.imageUrl,
      sourceCount: child.sourceCount,
      tags: child.tags,
      updatedAt: child.updatedAt,
    };
  }

  return {
    story,
    articles,
    summaries,
    relatedMetrics: relatedMetricData,
    parentStory,
    childStory,
  };
}

async function _getMarketData() {
  const from = getAllTimeStart();
  const to = getToday();

  const [nzx50Ohlc, airNzSeries, fphSeries, melSeries, fbuSeries, quotes] =
    await Promise.all([
      getStockTimeSeries(db, "^NZ50", from, to),
      getStockTimeSeries(db, "AIR.NZ", from, to),
      getStockTimeSeries(db, "FPH.NZ", from, to),
      getStockTimeSeries(db, "MEL.NZ", from, to),
      getStockTimeSeries(db, "FBU.NZ", from, to),
      getAllLatestQuotes(db, ["^NZ50", "AIR.NZ", "FPH.NZ", "MEL.NZ", "FBU.NZ"]),
    ]);

  return {
    nzx50: nzx50Ohlc.map((r) => ({
      date: r.date,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    })),
    bellwethers: {
      "AIR.NZ": airNzSeries.map((r) => ({ date: r.date, value: r.close })),
      "FPH.NZ": fphSeries.map((r) => ({ date: r.date, value: r.close })),
      "MEL.NZ": melSeries.map((r) => ({ date: r.date, value: r.close })),
      "FBU.NZ": fbuSeries.map((r) => ({ date: r.date, value: r.close })),
    },
    quotes: quotes.map((q) => ({
      ticker: q.ticker,
      close: q.close,
      date: q.date,
    })),
  };
}

// Cached exports — data is cached indefinitely and invalidated via revalidateTag("metrics")
const CACHE_OPTS = { tags: ["metrics"] };

export const getTickerData = unstable_cache(
  _getTickerData,
  ["ticker"],
  CACHE_OPTS
);
export const getOverviewData = unstable_cache(
  _getOverviewData,
  ["overview"],
  CACHE_OPTS
);
export const getCostOfLivingData = unstable_cache(
  _getCostOfLivingData,
  ["cost-of-living"],
  CACHE_OPTS
);
export const getHorizonData = unstable_cache(
  _getHorizonData,
  ["horizon-chart"],
  CACHE_OPTS
);
export const getIntroData = unstable_cache(
  _getIntroData,
  ["intro"],
  CACHE_OPTS
);
export const getGroceryChartData = unstable_cache(
  _getGroceryChartData,
  ["grocery-chart"],
  CACHE_OPTS
);
export const getFuelChartData = unstable_cache(
  _getFuelChartData,
  ["fuel-chart"],
  CACHE_OPTS
);
export const getHousingChartData = unstable_cache(
  _getHousingChartData,
  ["housing-chart"],
  CACHE_OPTS
);
export const getLabourChartData = unstable_cache(
  _getLabourChartData,
  ["labour-chart"],
  CACHE_OPTS
);
export const getCurrencyChartData = unstable_cache(
  _getCurrencyChartData,
  ["currency-chart"],
  CACHE_OPTS
);
export const getNewsData = unstable_cache(_getNewsData, ["news"], CACHE_OPTS);
export const getNewsPageData = unstable_cache(
  _getNewsPageData,
  ["news-page"],
  CACHE_OPTS
);
export function getStoryPageData(slug: string) {
  return unstable_cache(
    () => _getStoryPageData(slug),
    [`story-${slug}`],
    CACHE_OPTS
  )();
}
export const getMarketData = unstable_cache(
  _getMarketData,
  ["market"],
  CACHE_OPTS
);

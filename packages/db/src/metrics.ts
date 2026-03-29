export const METRIC_CATEGORIES = {
  everyday_costs: "Everyday Costs",
  housing: "Housing",
  employment_income: "Employment & Income",
  macro_financial: "Macro / Financial",
} as const;

export type MetricCategory = keyof typeof METRIC_CATEGORIES;

export type MetricMeta = {
  label: string;
  unit: string;
  category: MetricCategory;
  description: string;
};

export const METRIC_META = {
  petrol_91: { label: "Petrol 91", unit: "nzd_per_litre", category: "everyday_costs", description: "91 octane petrol price" },
  petrol_95: { label: "Petrol 95", unit: "nzd_per_litre", category: "everyday_costs", description: "95 octane petrol price" },
  petrol_diesel: { label: "Diesel", unit: "nzd_per_litre", category: "everyday_costs", description: "Diesel price" },
  milk: { label: "Milk", unit: "nzd", category: "everyday_costs", description: "2L standard milk" },
  eggs: { label: "Eggs", unit: "nzd", category: "everyday_costs", description: "Dozen size 7 eggs" },
  bread: { label: "Bread", unit: "nzd", category: "everyday_costs", description: "White loaf" },
  butter: { label: "Butter", unit: "nzd", category: "everyday_costs", description: "500g block" },
  cheese: { label: "Cheese", unit: "nzd", category: "everyday_costs", description: "1kg mild cheese" },
  rent_national: { label: "Rent", unit: "nzd_per_week", category: "everyday_costs", description: "Median weekly rent (national)" },
  electricity: { label: "Electricity", unit: "nzd_per_kwh", category: "everyday_costs", description: "Average residential electricity price" },
  house_price_median: { label: "Median House Price", unit: "nzd", category: "housing", description: "National median house price" },
  mortgage_floating: { label: "Mortgage (Floating)", unit: "percent", category: "housing", description: "Floating mortgage rate" },
  mortgage_1yr: { label: "Mortgage (1yr Fixed)", unit: "percent", category: "housing", description: "1-year fixed mortgage rate" },
  mortgage_2yr: { label: "Mortgage (2yr Fixed)", unit: "percent", category: "housing", description: "2-year fixed mortgage rate" },
  rent_vs_buy: { label: "Rent vs Buy", unit: "ratio", category: "housing", description: "Rent-to-price ratio" },
  unemployment: { label: "Unemployment", unit: "percent", category: "employment_income", description: "Unemployment rate" },
  median_income: { label: "Median Income", unit: "nzd", category: "employment_income", description: "Median annual income" },
  wage_growth: { label: "Wage Growth", unit: "percent", category: "employment_income", description: "Annual wage growth" },
  minimum_wage: { label: "Minimum Wage", unit: "nzd_per_hour", category: "employment_income", description: "Current minimum wage" },
  ocr: { label: "OCR", unit: "percent", category: "macro_financial", description: "Official Cash Rate" },
  cpi: { label: "CPI", unit: "percent", category: "macro_financial", description: "Consumer Price Index annual change" },
  nzd_usd: { label: "NZD/USD", unit: "ratio", category: "macro_financial", description: "NZD to USD exchange rate" },
  nzd_aud: { label: "NZD/AUD", unit: "ratio", category: "macro_financial", description: "NZD to AUD exchange rate" },
  nzd_eur: { label: "NZD/EUR", unit: "ratio", category: "macro_financial", description: "NZD to EUR exchange rate" },
  gdp_growth: { label: "GDP Growth", unit: "percent", category: "macro_financial", description: "GDP quarterly growth" },
} as const satisfies Record<string, MetricMeta>;

export type MetricKey = keyof typeof METRIC_META;
export const METRIC_KEYS = Object.keys(METRIC_META) as MetricKey[];

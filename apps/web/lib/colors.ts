/**
 * Centralized color palette for the Kiwidex dashboard.
 *
 * DATA colors are for chart lines, area fills, and series identification.
 * INDICATOR colors are for trend arrows, change badges, and sparkline fills.
 *
 * Rule: Red and green are NEVER used for data series — only for indicators.
 */

// ---------------------------------------------------------------------------
// Indicator colors — reserved for up/down/neutral signals
// ---------------------------------------------------------------------------

export const INDICATOR = {
  up: "#2ea85a",
  down: "#e24b35",
  neutral: "#888888",
  upBg: "#f0fdf4",
  upBorder: "#bbf7d0",
  downBg: "#fef2f2",
  downBorder: "#fecaca",
  neutralBg: "#f4f2ed",
  neutralBorder: "#e5e0d5",
} as const;

// ---------------------------------------------------------------------------
// Data series colors — no red, no green
// ---------------------------------------------------------------------------

export const DATA = {
  blue: "#2d7fd4",
  burntOrange: "#d4752a",
  purple: "#8855cc",
  gold: "#e0a020",
  teal: "#4a8a7a",
  slatePurple: "#6a5acd",
  terracotta: "#b5543a",
  darkAmber: "#7a5c3a",
  warmAmber: "#c47a20",
  yellowGold: "#d4a030",
  cyan: "#2ca9c4",
} as const;

// ---------------------------------------------------------------------------
// Metric → color assignments
// ---------------------------------------------------------------------------

/** Fuel & energy series (always shown individually) */
export const FUEL_COLORS = {
  petrol_91: DATA.blue,
  petrol_95: DATA.burntOrange,
  petrol_diesel: DATA.purple,
  electricity: DATA.cyan,
} as const;

/** Grocery series (shown when expanded) */
export const GROCERY_COLORS = {
  milk: DATA.blue,
  eggs: DATA.gold,
  bread: DATA.slatePurple,
  butter: DATA.warmAmber,
  cheese: DATA.purple,
  bananas: DATA.yellowGold,
  combined: DATA.teal,
} as const;

/** Currency series */
export const CURRENCY_COLORS = {
  nzd_usd: DATA.blue,
  nzd_aud: DATA.burntOrange,
  nzd_eur: DATA.purple,
} as const;

/** Housing series */
export const HOUSING_COLORS = {
  floating: DATA.burntOrange,
  oneYear: DATA.blue,
  twoYear: DATA.slatePurple,
  median: DATA.teal,
} as const;

/** Labour series */
export const LABOUR_COLORS = {
  wageGrowth: DATA.blue,
  cpi: DATA.burntOrange,
  unemployment: DATA.purple,
} as const;

/** Stock market series */
export const STOCK_COLORS = {
  nzx_50: DATA.blue,
  air_nz: DATA.burntOrange,
  fph: DATA.purple,
  mel: DATA.teal,
  fbu: DATA.gold,
} as const;

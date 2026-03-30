# Data Palette Design

## Principle

Data series colors and indicator colors are **completely separate**. Red and green are reserved exclusively for up/down trend indicators — they never appear as chart line or area colors.

## Indicator Colors (reserved)

| Role     | Hex       | Name     | Usage                                      |
|----------|-----------|----------|---------------------------------------------|
| Up       | `#2ea85a` | Green    | Trend arrows, sparkline fills, change badges, bg tints |
| Down     | `#e24b35` | Red      | Trend arrows, sparkline fills, change badges, bg tints |
| Neutral  | `#888888` | Gray     | Flat/unchanged indicators                   |

**Background tints** for indicator contexts:
- Up: `#f0fdf4` bg, `#bbf7d0` border
- Down: `#fef2f2` bg, `#fecaca` border
- Neutral: `#f4f2ed` bg, `#e5e0d5` border

## Data Series Colors

### Fuel (warm orange/brown family)

| Metric         | Hex       | Name          |
|----------------|-----------|---------------|
| Petrol 91      | `#d4752a` | Burnt orange  |
| Petrol 95      | `#b5543a` | Terracotta    |
| Diesel         | `#7a5c3a` | Dark amber    |

### Grocery (blue/purple/gold family)

| Metric         | Hex       | Name          |
|----------------|-----------|---------------|
| Milk 2L        | `#2d7fd4` | Blue          |
| Eggs           | `#e0a020` | Gold          |
| Bread          | `#6a5acd` | Slate purple  |
| Butter         | `#c47a20` | Warm amber    |
| Cheese         | `#8855cc` | Purple        |
| Bananas        | `#d4a030` | Yellow-gold   |
| **Combined**   | `#4a8a7a` | Teal          |

### Reusable Pool (for housing, labour, currency)

These 6 base hues are reused across sections. Within any single chart, each series gets a unique color from this pool:

| Hex       | Name          | Example assignments                    |
|-----------|---------------|----------------------------------------|
| `#2d7fd4` | Blue          | CPI, NZD/USD, Milk                     |
| `#d4752a` | Burnt orange  | GDP, Petrol 91                         |
| `#8855cc` | Purple        | Unemployment, Cheese, Mortgage rates   |
| `#e0a020` | Gold          | Wage Growth, Eggs                      |
| `#4a8a7a` | Teal          | House Price, Groceries combined        |
| `#6a5acd` | Slate purple  | Mortgage rates, Bread                  |

Colors can repeat across different sections (CPI in one chart and Milk in another can both be blue) — they just need to be unique within a single chart.

## Implementation

All colors should be defined in a single `apps/web/lib/colors.ts` file:

```ts
// Indicator colors — reserved, never used for data series
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

// Data series colors — no red, no green
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
} as const;
```

All chart components, section components, and queries.ts should import from this file instead of hardcoding hex values.

## Scope

- Replace all hardcoded data colors in `queries.ts`, chart components, and section components
- Replace all hardcoded indicator colors (trend arrows, sparkline fills, change badges)
- Do not change UI chrome colors (borders, backgrounds, text) — those are a separate concern
- Do not change news source badge colors (RNZ red, Stuff blue, etc.) — those are brand colors

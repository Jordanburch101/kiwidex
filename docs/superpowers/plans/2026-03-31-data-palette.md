# Data Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize all data series and indicator colors in a single `colors.ts` file, replacing ~40 hardcoded hex values across 10 files.

**Architecture:** Create `apps/web/lib/colors.ts` as the single source of truth. Data series colors avoid red/green entirely. Red and green are reserved for up/down indicators. All chart components, section components, and UI components import from this file.

**Tech Stack:** TypeScript constants, no runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-03-31-data-palette-design.md`

---

### Task 1: Create colors.ts

**Files:**
- Create: `apps/web/lib/colors.ts`

- [ ] **Step 1: Create the color constants file**

```ts
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
} as const;

// ---------------------------------------------------------------------------
// Metric → color assignments
// ---------------------------------------------------------------------------

/** Fuel series (always shown individually) */
export const FUEL_COLORS = {
  petrol_91: DATA.burntOrange,
  petrol_95: DATA.terracotta,
  petrol_diesel: DATA.darkAmber,
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/colors.ts
git commit -m "feat: add centralized color palette (colors.ts)"
```

---

### Task 2: Update queries.ts

**Files:**
- Modify: `apps/web/lib/queries.ts` (lines 296-311, 130-148, 245-276)

- [ ] **Step 1: Replace COST_OF_LIVING_ITEMS colors**

Update the color assignments in `COST_OF_LIVING_ITEMS` to import from `colors.ts`:

```ts
import { FUEL_COLORS, GROCERY_COLORS } from "./colors";
```

Replace the items array colors:
```ts
{ metric: "petrol_91", label: "Petrol 91", color: FUEL_COLORS.petrol_91, group: "fuel" },
{ metric: "petrol_95", label: "Petrol 95", color: FUEL_COLORS.petrol_95, group: "fuel" },
{ metric: "petrol_diesel", label: "Diesel", color: FUEL_COLORS.petrol_diesel, group: "fuel" },
{ metric: "milk", label: "Milk 2L", color: GROCERY_COLORS.milk, group: "grocery" },
{ metric: "eggs", label: "Eggs", color: GROCERY_COLORS.eggs, group: "grocery" },
{ metric: "bread", label: "Bread", color: GROCERY_COLORS.bread, group: "grocery" },
{ metric: "butter", label: "Butter", color: GROCERY_COLORS.butter, group: "grocery" },
{ metric: "cheese", label: "Cheese", color: GROCERY_COLORS.cheese, group: "grocery" },
{ metric: "bananas", label: "Bananas", color: GROCERY_COLORS.bananas, group: "grocery" },
```

- [ ] **Step 2: Replace trend color function**

Find the `getTrendColor` or similar function (~lines 130-148) that returns `#c44`, `#3a8a3a`, `#998`. Replace with:

```ts
import { INDICATOR } from "./colors";
```

Replace `#c44` → `INDICATOR.down`, `#3a8a3a` → `INDICATOR.up`, `#998` → `INDICATOR.neutral`.

- [ ] **Step 3: Replace overview card colors**

Find the overview card data (~lines 245-276) and replace:
- `#c44` → `FUEL_COLORS.petrol_91`
- `oklch(0.845 0.143 164.978)` → `GROCERY_COLORS.milk`
- `oklch(0.508 0.118 165.612)` → `HOUSING_COLORS.median`
- `#e68a00` → `HOUSING_COLORS.oneYear`

- [ ] **Step 4: Verify the dev server still renders**

```bash
curl -s http://localhost:3001 | grep -c 'Kiwidex'
```

Expected: `1` (page loads)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/queries.ts
git commit -m "refactor: use centralized palette in queries.ts"
```

---

### Task 3: Update cost-of-living-chart.tsx

**Files:**
- Modify: `apps/web/components/charts/cost-of-living-chart.tsx` (line 57)

- [ ] **Step 1: Replace GROCERY_META color**

```ts
import { GROCERY_COLORS } from "@/lib/colors";
```

Replace line 57:
```ts
// Before:
color: "#5a8a5a",
// After:
color: GROCERY_COLORS.combined,
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/charts/cost-of-living-chart.tsx
git commit -m "refactor: use centralized palette in cost-of-living chart"
```

---

### Task 4: Update section components

**Files:**
- Modify: `apps/web/components/sections/fuel-charts.tsx` (lines 31-33)
- Modify: `apps/web/components/sections/currency-charts.tsx` (lines 31-33)
- Modify: `apps/web/components/sections/housing-charts.tsx` (lines 57-59)
- Modify: `apps/web/components/sections/labour-deep-dive.tsx` (lines 46-47, 57)

- [ ] **Step 1: Update fuel-charts.tsx**

```ts
import { FUEL_COLORS } from "@/lib/colors";
```

Replace:
- `#c44` → `FUEL_COLORS.petrol_91`
- `#e68a00` → `FUEL_COLORS.petrol_95`
- `#3a8a3a` → `FUEL_COLORS.petrol_diesel`

- [ ] **Step 2: Update currency-charts.tsx**

```ts
import { CURRENCY_COLORS } from "@/lib/colors";
```

Replace:
- `#c44` → `CURRENCY_COLORS.nzd_usd`
- `#3a8a3a` → `CURRENCY_COLORS.nzd_aud`
- `#e68a00` → `CURRENCY_COLORS.nzd_eur`

- [ ] **Step 3: Update housing-charts.tsx**

```ts
import { HOUSING_COLORS } from "@/lib/colors";
```

Replace:
- `#c44` → `HOUSING_COLORS.floating`
- `#e68a00` → `HOUSING_COLORS.oneYear`
- `#3a8a3a` → `HOUSING_COLORS.twoYear`

- [ ] **Step 4: Update labour-deep-dive.tsx**

```ts
import { LABOUR_COLORS } from "@/lib/colors";
```

Replace:
- `#3a8a3a` (Wage Growth) → `LABOUR_COLORS.wageGrowth`
- `#c44` (CPI) → `LABOUR_COLORS.cpi`
- `#e68a00` (Unemployment) → `LABOUR_COLORS.unemployment`

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/sections/fuel-charts.tsx apps/web/components/sections/currency-charts.tsx apps/web/components/sections/housing-charts.tsx apps/web/components/sections/labour-deep-dive.tsx
git commit -m "refactor: use centralized palette in section components"
```

---

### Task 5: Update UI components (indicators)

**Files:**
- Modify: `packages/ui/src/components/metric-card.tsx` (lines 22-27)
- Modify: `packages/ui/src/components/compact-row.tsx` (lines 25, 39-45)

- [ ] **Step 1: Update metric-card.tsx indicator colors**

Since this is in `packages/ui`, the import path is different. `colors.ts` lives in `apps/web/lib/`. To avoid a cross-package dependency, re-export the indicator colors from the UI package or pass them as props.

Simplest approach: the indicator hex values are used inline in template strings. Replace them directly:

```ts
// At the top of metric-card.tsx
const INDICATOR = {
  up: "#2ea85a",
  down: "#e24b35",
  neutral: "#888888",
  upBg: "#f0fdf4",
  downBg: "#fef2f2",
  neutralBg: "#f4f2ed",
} as const;
```

Then replace:
- `#c44` → `INDICATOR.down`
- `#3a8a3a` → `INDICATOR.up`
- `#998` (in indicator context) → `INDICATOR.neutral`

Note: Keep `#998` for muted text labels — that's UI chrome, not an indicator.

- [ ] **Step 2: Update compact-row.tsx indicator colors**

Same pattern — add the `INDICATOR` constant at the top, then replace:
- `#c44` → `INDICATOR.down`
- `#3a8a3a` → `INDICATOR.up`
- `#fef2f2` → `INDICATOR.downBg`
- `#f0fdf4` → `INDICATOR.upBg`
- `#f4f2ed` (in indicator pill context) → `INDICATOR.neutralBg`

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/metric-card.tsx packages/ui/src/components/compact-row.tsx
git commit -m "refactor: use named indicator colors in UI components"
```

---

### Task 6: Verify and clean up

- [ ] **Step 1: Grep for orphaned hardcoded data colors**

```bash
grep -rn '#c44\|#cc4444\|#3a8a3a\|#e68a00\|#5599aa\|#aa8855\|#8855aa\|#d4a017\|#996633\|#e06030\|#5a8a5a' apps/web/components/ apps/web/lib/ packages/ui/src/
```

Expected: No matches for data series colors. Any remaining `#c44` or `#3a8a3a` should be in indicator constants only.

- [ ] **Step 2: Verify the dashboard renders correctly**

Open the dashboard in the browser and check:
- Cost-of-living chart: fuel lines are orange/terracotta/amber (not red/green)
- Grocery expanded: blue/gold/purple family
- Currency chart: blue/orange/purple (not red/green)
- Housing chart: orange/blue/purple (not red/green)
- Labour chart: blue/orange/purple (not red/green)
- Trend indicators: still red/green arrows and badges

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "refactor: data palette migration complete — no red/green in data series"
```

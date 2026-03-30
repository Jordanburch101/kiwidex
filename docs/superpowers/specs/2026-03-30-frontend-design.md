# NZ Ecom — Frontend Design Spec

> Dashboard design for the NZ economy health landing page.
> Editorial broadsheet layout, chart-heavy, light mode.

## Layout Structure

### Masthead
- Centered: "The New Zealand Economy" subtitle, "The Kiwidex" title (Playfair Display serif), date + last updated
- Bottom border: 2px solid dark

### Scrolling Marquee Ticker
- Sits below masthead, warm stone background (#f5f3ee)
- Scrolls continuously, pauses on hover
- **Daily-changing data only:** Petrol (91/95/diesel) + Groceries (milk/eggs/bread/butter/cheese) + FX (NZD/USD/AUD/EUR)
- Each item: label + bold value + mini sparkline (Style 1)
- Items separated by dot dividers, grouped by type

### 3-Column Overview (above the fold)

**Left column (1.3fr): "At the Pump & Shelf"**
- Style 4 metric cards: large serif number, coloured trend pill (▲/▼), area chart with gradient fill, date range labels
- Primary: Petrol 91 with 12mo chart
- Secondary: Milk 2L with 12mo chart

**Middle column (1fr): "Housing & Rates"**
- Style 4 metric cards
- Primary: Median House Price
- Secondary: 1yr Fixed Mortgage Rate

**Right column (0.7fr): "The Economy"**
- Compact sparkline rows (Style 3): label → value → inline sparkline → change
- OCR, CPI/Inflation, Unemployment, GDP, Wages, Minimum Wage
- Single card with stacked rows, hairline dividers

### Deep Dive Sections (below the fold)

Full-width sections, each with a header (Playfair Display serif title + subtitle with data source). Separated by 1px borders.

**Section 1: Grocery Prices**
- Daily averages across Woolworths, Pak'nSave, New World
- Charts: Individual item trends (area), store price comparison (grouped bar), brand ranking (horizontal bar)
- Price range bands showing cheapest → most expensive across stores

**Section 2: Fuel**
- Petrol 91/95/diesel multi-line overlay
- Candlestick for weekly volatility
- Heat map calendar for daily price patterns (optional)

**Section 3: Housing & Mortgages**
- Dual axis: house price vs mortgage rate (correlation)
- Multi-line: floating vs 1yr vs 2yr fixed rates
- Lollipop comparison of current rates

**Section 4: Labour & Income**
- Dual axis: wage growth vs CPI (are wages keeping up?)
- Unemployment trend (5yr area chart)
- Average income quarterly trend

**Section 5: Currency & Trade**
- NZD/USD 12mo line chart (daily granularity)
- Multi-line: AUD + EUR comparison

### Footer
- Data sources attribution
- Update frequency note

## Visual Design

- **Palette:** Existing warm stone OKLch theme (hue ~107)
- **Typography:** Playfair Display for headings/numbers, Noto Sans for body/labels, Geist Mono for data values in compact rows
- **Background:** #faf9f6 (warm off-white), cards white with #e8e4dc borders
- **Trend colours:** Red (#c44) for cost increases (bad), Green (#3a8a3a) for decreases (good)
- **Chart colours:** Use existing chart-1 through chart-5 CSS vars for multi-series
- **Mode:** Light only (no dark mode for this page)
- **Borders:** Hairline 1px #e5e0d5, 2px dark for section dividers
- **Radius:** 6px on cards (existing --radius: 0.45rem)

## Technical

- **Charts:** Recharts (already in @workspace/ui)
- **Data:** Server Components fetching from @workspace/db via getTimeSeries, getLatestValue, getLatestByCategory
- **Sparklines:** Custom SVG components (lightweight, no Recharts overhead)
- **Marquee:** CSS animation with duplicated content for seamless loop
- **Responsive:** Collapse 3-column to stacked on mobile (defer detailed mobile design)

## Out of Scope

- Dark mode
- Detailed mobile responsive design (basic stacking only)
- Interactive chart tooltips (defer)
- Insight/derived charts (need historical data backfill first)
- User preferences/settings

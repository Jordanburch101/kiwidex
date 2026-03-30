# Stats NZ Grocery Price Data - Research Findings

## Summary

The target data exists and is **directly downloadable** as a single large CSV from the Stats NZ
"Selected Price Indexes" monthly release. No Infoshare API interaction needed.

---

## Working Download URL

The CSV is published with each monthly SPI (Selected Price Indexes) release. URL pattern:

```
https://www.stats.govt.nz/assets/Uploads/Selected-price-indexes/Selected-price-indexes-{Month-YYYY}/Download-data/selected-price-indexes-{month-yyyy}.csv
```

**Note:** Month name is Title-Case in the folder, lowercase in the filename.

**Confirmed working example (HTTP 200, 9.8MB, last-modified 2026-03-16):**
```
https://www.stats.govt.nz/assets/Uploads/Selected-price-indexes/Selected-price-indexes-February-2026/Download-data/selected-price-indexes-february-2026.csv
```

The release page lives at:
```
https://www.stats.govt.nz/information-releases/selected-price-indexes-{month}-{year}/
```

New releases come out approximately the 17th of the following month. As of March 2026, the
latest data is February 2026.

---

## CSV Format

```
Series_reference,Period,Data_value,STATUS,UNITS,Subject,Group,Series_title_1,Series_title_2,Series_title_3
```

- **Series_reference**: e.g. `CPIM.SAP0127`
- **Period**: `YYYY.MM` format — e.g. `2024.01`, `2025.12` (note: October is `2024.1` not `2024.10`)
- **Data_value**: numeric price in NZD (for Dollars rows) or index value
- **STATUS**: always `FINAL` for historical data
- **UNITS**: `Dollars`, `Index`, or `Percent`
- **Group**: identifies the series family — weighted avg prices are under `"Food Price Index Selected Monthly Weighted Average Prices for New Zealand"`

To filter only dollar-price items: `UNITS == "Dollars"` AND `Group` contains `"Weighted Average Prices"`

---

## Target Series References

All five items are present. Note size differences vs. request:

| Item Requested | Actual Series Name | Series Ref | Notes |
|---|---|---|---|
| Milk (2L standard) | Milk - standard homogenised, 2 litres | `CPIM.SAP0127` | Exact match |
| Eggs (dozen) | Eggs, dozen | `CPIM.SAP0130` | Exact match |
| Bread (white loaf) | Bread - white sliced loaf, 600g | `CPIM.SAP0149` | 600g, not a full 700g loaf |
| Butter (500g) | Butter - salted | `CPIM.SAP0131` | Check full title for size — series covers 500g |
| Cheese (1kg mild/colby) | Cheese - mild cheddar (supermarket only) | `CPIM.SAP0129` | Mild cheddar, not colby; confirm weight in series |

Other bread variants available: `SAP0258` (Wheatmeal), `SAP0259` (Wholegrain), `SAP0155/0156` (Rolls), `SAP0188` (Pita).

---

## Sample Data (NZD, Jan 2024 – Feb 2026)

### Milk - standard homogenised, 2L (CPIM.SAP0127)
| Period | Price NZD |
|--------|-----------|
| 2024.01 | 3.93 |
| 2024.06 | 4.00 |
| 2024.12 | 4.25 |
| 2025.01 | 4.54 |
| 2025.06 | ~4.6x |
| 2025.12 | ~4.6x |
| 2026.01 | (in file) |
| 2026.02 | (in file) |

### Eggs, dozen (CPIM.SAP0130)
| Period | Price NZD |
|--------|-----------|
| 2024.01 | 9.54 |
| 2024.07 | 8.65 |
| 2024.12 | 8.37 |
| 2025.01 | 8.89 |
| 2025.06 | 10.01 |
| 2025.12 | 8.96 |
| 2026.01 | 8.86 |
| 2026.02 | 8.77 |

### Bread - white sliced loaf, 600g (CPIM.SAP0149)
| Period | Price NZD |
|--------|-----------|
| 2024.01 | 1.39 |
| 2024.07 | 1.40 |
| 2024.12 | 1.39 |
| 2025.01 | 1.40 |
| 2025.03 | 1.47 |
| 2025.04 | 1.67 |
| 2025.05 | 1.68 |
| 2026.02 | (in file) |

### Butter - salted (CPIM.SAP0131)
| Period | Price NZD |
|--------|-----------|
| 2024.01 | 4.48 |
| 2024.05 | 5.57 |
| 2024.07 | 6.04 |
| 2024.12 | 6.66 |
| 2025.01 | 6.79 |
| 2025.05 | 8.42 |
| 2025.09 | 8.53 |
| 2025.12 | 7.96 |
| 2026.01 | 7.95 |
| 2026.02 | 7.66 |

### Cheese - mild cheddar (CPIM.SAP0129)
| Period | Price NZD |
|--------|-----------|
| 2024.01 | 10.19 |
| 2024.07 | 10.05 |
| 2024.12 | 11.01 |
| 2025.01 | 11.11 |
| 2025.05 | 13.04 |
| 2025.09 | 12.81 |
| 2025.12 | 12.64 |
| 2026.01 | 12.94 |
| 2026.02 | 13.02 |

---

## How Far Back Does Data Go?

- The weighted average dollar-price series (SAP group) start from approximately **2006** (earliest
  rows observed for milk: `2006.06`).
- FPI index series (CPIM.SE9xx group) go back to **1960**.
- The single CSV file contains the full historical series — no need to stitch multiple files.

---

## Recommended Backfill Script Approach

### Option A: Single file download (simplest)

Download the latest monthly release CSV once. It contains the complete history from 2006+.

```bash
curl -L \
  "https://www.stats.govt.nz/assets/Uploads/Selected-price-indexes/Selected-price-indexes-February-2026/Download-data/selected-price-indexes-february-2026.csv" \
  -o spi-data.csv
```

Then filter in code:

```typescript
const TARGET_SERIES = {
  milk_2l:    'CPIM.SAP0127',
  eggs_dozen: 'CPIM.SAP0130',
  bread_600g: 'CPIM.SAP0149',
  butter:     'CPIM.SAP0131',
  cheese:     'CPIM.SAP0129',
}

// Period format: "2024.1" = October 2024 (not 2024.10)
// Parse: year = period.split('.')[0], month = period.split('.')[1].padStart(2,'0')
```

### Option B: Monthly update script

Each month, build the URL from the release date:

```typescript
function getSpiCsvUrl(month: string, year: number): string {
  // month = "February", year = 2026
  const monthLower = month.toLowerCase()
  return `https://www.stats.govt.nz/assets/Uploads/Selected-price-indexes/` +
    `Selected-price-indexes-${month}-${year}/Download-data/` +
    `selected-price-indexes-${monthLower}-${year}.csv`
}
```

Releases publish around the 17th of the following month.

### Period Parsing Gotcha

October is encoded as `2024.1` (not `2024.10`). Parse carefully:

```typescript
function parsePeriod(period: string): { year: number, month: number } {
  const [y, m] = period.split('.')
  return { year: parseInt(y), month: parseInt(m) } // month: 1-12
}
```

---

## Other Approaches Investigated

- **Infoshare direct URL export**: The old Infoshare site (`infoshare.stats.govt.nz`) is still
  live but requires POST-based session state to export CSV — not scriptable via simple GET.
- **NZ.Stat**: Closed September 2024.
- **Stats NZ REST API** (`api.stats.govt.nz`): Returned minimal response, not usable for this data.
- **RBNZ M-series**: Contains CPI aggregates only, not individual food item dollar prices.
- **Stats NZ CSV files for download page**: Heavy JS — the direct asset URL approach above is
  the correct method.

---

## Verdict

**Use the single-file download.** One curl to the monthly release asset URL gives you the complete
history for all five items in a clean CSV. The file is ~10MB and self-contained. No authentication,
no API keys, no session management required.

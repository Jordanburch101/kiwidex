# Footer Redesign — The Kiwidex

## Overview

Replace the placeholder footer with a newspaper-colophon-style footer that matches the editorial aesthetic of the rest of the dashboard. Adds newsletter signup UI, project about section, and creator credit alongside the existing data sources and update schedule information.

## Structure

The footer has four vertically stacked sections, all within the existing `<Footer />` component at `apps/web/components/sections/footer.tsx`.

### 1. Newsletter Band

- Full-width row with flexbox layout (stacks on mobile)
- Left: Playfair Display heading "Stay Across the Numbers" + subtitle "Weekly briefing on what moved in the NZ economy — data, not opinions."
- Right: Email input + "Subscribe" button
- Input: `1px solid #d5d0c5` border, `#faf9f6` background, placeholder "your@email.co.nz"
- Button: `#2a2520` fill, uppercase tracked label, hover inverts to outlined
- **Functionality**: UI only for now. Form does `preventDefault()`. Will wire to Resend audience later.
- Separated from content below by `1px solid #e5e0d5` bottom border

### 2. Three-Column Info Grid

Three equal columns separated by vertical rules (`border-right: 1px solid #e5e0d5`). Collapses to single column on mobile (vertical rules become horizontal).

Each column has an uppercase tracked label (`9px`, `#998`, `letter-spacing: 0.25em`) with a thin underline border.

#### Column A: About This Project

Short paragraph describing The Kiwidex:
> "The Kiwidex tracks New Zealand's key economic indicators in one place. Data is collected daily from public sources and presented without commentary — a dashboard for anyone who wants to see what's actually happening."

Followed by: "Built by [Jordan Burch](https://jordanburch.dev)"

#### Column B: Data Sources

Label/detail paired rows:
| Source | Detail |
|--------|--------|
| Reserve Bank (RBNZ) | OCR, FX, Mortgages |
| Stats NZ | CPI, GDP, Employment |
| MBIE | Fuel, Min. wage |
| REINZ | House prices |
| Supermarkets | Grocery prices |
| Electricity Authority | Power prices |

#### Column C: Update Schedule

Label/detail paired rows:
| Metric | Frequency |
|--------|-----------|
| Fuel & groceries | Daily |
| Exchange rates | Daily |
| Electricity | Daily |
| Mortgage rates | Weekly |
| House prices | Monthly |
| CPI, GDP, Employment | Quarterly |

### 3. Colophon Bar

Three-part horizontal bar:
- Left: Disclaimer text ("Data collected from public sources. May not reflect real-time values.")
- Center: "The Kiwidex" in Playfair Display, muted (`#d5d0c5`)
- Right: Link to jordanburch.dev

### 4. Top Border

`2px solid #2a2520` — matches the masthead's bottom border, creating visual bookending.

## Typography & Color

All values drawn from existing site tokens:
- Heading font: Playfair Display (via `font-heading` CSS variable)
- Body font: Noto Sans (via `font-sans` CSS variable)
- Primary text: `#2a2520`
- Secondary text: `#777`
- Muted text: `#998`, `#bbb`
- Borders: `#e5e0d5`
- Strong border: `#2a2520`
- Background: inherits `#faf9f6` from page shell

## Responsive Behavior

At `< 768px` (sm breakpoint):
- Newsletter band stacks vertically, text centers, input goes full-width
- Three-column grid becomes single column, vertical rules become horizontal borders
- Colophon stacks vertically, centers

## Files Changed

- `apps/web/components/sections/footer.tsx` — complete rewrite of the component

## Out of Scope

- Newsletter form submission / Resend integration (future work)
- Dark mode styling (not currently implemented site-wide)

# Pretext-Powered Intro Layout

## Problem

The AI-generated intro paragraph uses CSS `float` for the drop cap, which causes:
- Inline metric badges break awkwardly across lines
- Uneven spacing around badges
- No control over line breaks — the browser decides
- The drop cap alignment is fragile (hardcoded `height: 70.88px`)

## Solution

Replace the CSS float layout with pretext's `layoutNextLine` for precise text flow around the drop cap. Badges are measured and accounted for in the layout calculation so lines never overflow.

## Architecture

### Component Split

```
<Intro />              — Server Component (unchanged)
  └─ getIntroData()    — reads summary + metrics from DB
  └─ <IntroLayout />   — "use client" component (new)
       └─ pretext      — measures text + badge widths, calculates line breaks
```

### Data Flow

1. `<Intro />` (Server Component) fetches `{ summary, metrics }` from DB
2. Passes to `<IntroLayout summary={...} metrics={...} />`
3. `IntroLayout` parses the summary text, identifying `{metric}` placeholders
4. On mount + resize:
   - Measures container width via `ResizeObserver`
   - Measures drop cap element width (the "A")
   - Builds a measurement string where badge placeholders are replaced with padded equivalents
   - Uses pretext `prepareWithSegments` to measure text segments
   - Uses `layoutNextLine` with narrower width for lines beside the drop cap, full width after
   - Renders each line as a `<div>`, with badges as inline `<span>` elements

### Badge Width Accounting

Badges have ~12px of extra width vs plain text (6px padding each side). To account for this:

1. Parse the summary into segments: `[text, badge, text, badge, ...]`
2. For each badge, measure the formatted metric value text width using a hidden canvas
3. Add badge padding (12px total) to get the true badge width
4. Pass these widths to pretext as segment widths when calculating line breaks
5. When a badge would cause a line to exceed max width, break before it

### Drop Cap Sizing

- The drop cap "A" is positioned absolutely in its own container
- Its width is measured at runtime (font rendering varies by browser/OS)
- The number of indented lines is calculated from: `dropCapHeight / lineHeight`
- Lines within the drop cap zone use `containerWidth - dropCapWidth - gap`
- Lines after use full `containerWidth`

### Resize Handling

- `ResizeObserver` watches the container
- On resize, only `layoutNextLine` reruns (cheap — pure arithmetic)
- `prepare` is called once on mount (the expensive step)
- Recalculate also triggers when `summary` or `metrics` props change

## Files

| File | Change |
|------|--------|
| `apps/web/components/sections/intro.tsx` | Simplify to Server Component shell, delegates to IntroLayout |
| `apps/web/components/sections/intro-layout.tsx` | New "use client" component with pretext layout logic |
| `apps/web/package.json` | Add `@chenglou/pretext` dependency |

## Styling

- Drop cap: `font-heading` (Playfair Display), ~68px, `color: #2a2520`, absolutely positioned
- Body text: Noto Sans, 13.5px, `color: #444038`, `line-height: 1.75`
- Badges: `bg-[#f0ecdf]`, `px-1.5 py-0.5`, `font-semibold`, `text-[#2a2520]`, `rounded`, `white-space: nowrap`
- Each line is a `<div>` — no wrapping within a line
- "SUMMARY · DATE" label below, unchanged

## Edge Cases

- **No summary in DB**: render nothing (return `null`)
- **Very short text**: fewer lines than drop cap height — drop cap still renders, text doesn't indent extra
- **Very long text**: pretext handles naturally — just more full-width lines
- **Missing metric values**: badge shows "—" (existing behavior)
- **SSR**: Initial render shows unstyled text (no pretext on server). Layout applies on hydration. Use `visibility: hidden` until measured to prevent flash.

## Out of Scope

- Canvas/SVG rendering (DOM only)
- Animation or transitions
- Dark mode changes (inherits existing theme)

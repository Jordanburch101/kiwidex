# Pretext-Powered Intro Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the CSS float drop-cap layout with pretext's `layoutNextLine` for precise text wrapping, pixel-accurate badge accounting, and responsive line breaks.

**Architecture:** Server Component (`Intro`) fetches summary + metrics from DB, passes to a `"use client"` component (`IntroLayout`) that uses pretext to calculate line breaks around an absolutely-positioned drop cap. Badges are measured and accounted for so lines never overflow.

**Tech Stack:** `@chenglou/pretext`, React 19, Next.js 16 App Router

---

### File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/package.json` | Modify | Add `@chenglou/pretext` dependency |
| `apps/web/components/sections/intro-layout.tsx` | Create | `"use client"` component — pretext layout, drop cap positioning, badge rendering |
| `apps/web/components/sections/intro.tsx` | Modify | Simplify to thin Server Component shell that delegates to IntroLayout |

---

### Task 1: Install pretext

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install the dependency**

```bash
cd apps/web && bun add @chenglou/pretext
```

- [ ] **Step 2: Verify it installed**

```bash
bun pm ls | grep pretext
```

Expected: `@chenglou/pretext@<version>`

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: add @chenglou/pretext dependency"
```

---

### Task 2: Create IntroLayout client component

**Files:**
- Create: `apps/web/components/sections/intro-layout.tsx`

- [ ] **Step 1: Create the component file**

```tsx
"use client";

import { prepareWithSegments, layoutNextLine } from "@chenglou/pretext";
import type { PreparedTextWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useRef, useState } from "react";

// Badge padding adds ~12px total width (6px each side from px-1.5)
const BADGE_EXTRA_PX = 12;
// Gap between drop cap and text
const DROP_CAP_GAP = 12;
// Regex matching metric placeholders in summary text
const BADGE_RE = /\{(ocr|cpi|nzd_usd|petrol_91|unemployment|wage_growth)\}/g;

type Part = { type: "text"; value: string } | { type: "badge"; value: string };

interface LayoutLine {
  parts: Part[];
  indented: boolean;
}

interface IntroLayoutProps {
  summary: string;
  metrics: Record<string, string>;
}

/**
 * Build the plain text (with badge values substituted in)
 * and collect the set of badge value strings for later matching.
 */
function buildFullText(
  summary: string,
  metrics: Record<string, string>
): { fullText: string; dropCap: string; badgeValues: Set<string> } {
  let fullText = "";
  const badgeValues = new Set<string>();
  let lastIndex = 0;

  for (const match of summary.matchAll(BADGE_RE)) {
    fullText += summary.slice(lastIndex, match.index);
    const key = match[1]!;
    const value = metrics[key] ?? "—";
    fullText += value;
    badgeValues.add(value);
    lastIndex = match.index + match[0].length;
  }
  fullText += summary.slice(lastIndex);

  // Extract drop cap (first character)
  const dropCap = fullText[0] ?? "A";
  fullText = fullText.slice(1);

  return { fullText, dropCap, badgeValues };
}

/**
 * Split a line's text into interleaved text and badge parts
 * by searching for known badge value strings.
 */
function splitLineIntoParts(lineText: string, badgeValues: Set<string>): Part[] {
  const parts: Part[] = [];
  let remaining = lineText;

  while (remaining.length > 0) {
    let earliestIndex = remaining.length;
    let earliestValue: string | null = null;

    for (const value of badgeValues) {
      const idx = remaining.indexOf(value);
      if (idx !== -1 && idx < earliestIndex) {
        earliestIndex = idx;
        earliestValue = value;
      }
    }

    if (earliestValue === null) {
      parts.push({ type: "text", value: remaining });
      break;
    }

    if (earliestIndex > 0) {
      parts.push({ type: "text", value: remaining.slice(0, earliestIndex) });
    }
    parts.push({ type: "badge", value: earliestValue });
    remaining = remaining.slice(earliestIndex + earliestValue.length);
  }

  return parts;
}

/**
 * Count how many badge values appear in a line's text.
 */
function countBadges(lineText: string, badgeValues: Set<string>): number {
  let count = 0;
  for (const value of badgeValues) {
    if (lineText.includes(value)) count++;
  }
  return count;
}

/**
 * Run pretext layout, flowing text around the drop cap.
 * Accounts for badge padding by reducing available width.
 */
function calculateLines(
  prepared: PreparedTextWithSegments,
  containerWidth: number,
  dropCapWidth: number,
  dropCapLines: number,
  badgeValues: Set<string>
): LayoutLine[] {
  const lines: LayoutLine[] = [];
  let cursor = { segmentIndex: 0, graphemeIndex: 0 };

  while (true) {
    const indented = lines.length < dropCapLines;
    const baseWidth = indented
      ? containerWidth - dropCapWidth - DROP_CAP_GAP
      : containerWidth;

    // First pass — layout with base width
    let line = layoutNextLine(prepared, cursor, baseWidth);
    if (line === null) break;

    // Check if badges in this line cause overflow
    const badgeCount = countBadges(line.text, badgeValues);
    if (badgeCount > 0) {
      const extraWidth = badgeCount * BADGE_EXTRA_PX;
      if (line.width + extraWidth > baseWidth) {
        // Re-layout with reduced width to account for badge padding
        const adjusted = layoutNextLine(prepared, cursor, baseWidth - extraWidth);
        if (adjusted !== null) {
          line = adjusted;
        }
      }
    }

    lines.push({
      parts: splitLineIntoParts(line.text, badgeValues),
      indented,
    });
    cursor = line.end;
  }

  return lines;
}

export function IntroLayout({ summary, metrics }: IntroLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropCapRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<LayoutLine[]>([]);
  const [ready, setReady] = useState(false);

  const { fullText, dropCap, badgeValues } = buildFullText(summary, metrics);

  // Store prepared text (expensive, only recompute when text changes)
  const preparedRef = useRef<PreparedTextWithSegments | null>(null);
  const prevTextRef = useRef<string>("");

  const doLayout = useCallback(() => {
    const container = containerRef.current;
    const dropCapEl = dropCapRef.current;
    if (!container || !dropCapEl) return;

    // Get the font from the container's computed style
    const style = getComputedStyle(container);
    const font = `${style.fontSize} ${style.fontFamily}`;
    const lineHeight = Number.parseFloat(style.lineHeight);

    // Prepare text (only if text changed)
    if (prevTextRef.current !== fullText || !preparedRef.current) {
      preparedRef.current = prepareWithSegments(fullText, font);
      prevTextRef.current = fullText;
    }

    // Measure drop cap
    const dropCapRect = dropCapEl.getBoundingClientRect();
    const dropCapWidth = dropCapRect.width;
    const dropCapHeight = dropCapRect.height;
    const dropCapLines = Math.ceil(dropCapHeight / lineHeight);

    // Container width (subtract horizontal padding)
    const containerWidth = container.clientWidth;

    const result = calculateLines(
      preparedRef.current,
      containerWidth,
      dropCapWidth,
      dropCapLines,
      badgeValues
    );

    setLines(result);
    setReady(true);
  }, [fullText, badgeValues]);

  useEffect(() => {
    doLayout();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => doLayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [doLayout]);

  return (
    <section aria-label="Economic summary" className="px-6">
      <div className="border-[#e5e0d5] border-b pb-6">
        <div ref={containerRef} className="relative" style={{ visibility: ready ? "visible" : "hidden" }}>
          {/* Drop cap — absolutely positioned in its own element */}
          <span
            ref={dropCapRef}
            className="absolute top-0 left-0 font-bold font-heading text-[#2a2520] text-[68px]"
            style={{ lineHeight: "0.85" }}
          >
            {dropCap}
          </span>

          {/* Lines laid out by pretext */}
          <div className="text-[#444038] text-[13.5px] leading-[1.75]">
            {lines.map((line, i) => (
              <div
                key={i}
                style={line.indented ? { marginLeft: `${(dropCapRef.current?.getBoundingClientRect().width ?? 52) + DROP_CAP_GAP}px` } : undefined}
              >
                {line.parts.map((part, j) =>
                  part.type === "badge" ? (
                    <span
                      key={j}
                      className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {part.value}
                    </span>
                  ) : (
                    <span key={j}>{part.value}</span>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Fallback for SSR — plain text, hidden once layout is ready */}
        {!ready && (
          <p className="text-[#444038] text-[13.5px] leading-[1.75]" aria-hidden>
            {fullText}
          </p>
        )}

        <p className="mt-3 text-[#998] text-[9px] uppercase tracking-wider">
          Summary &middot;{" "}
          {new Date().toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the file has no TypeScript errors**

```bash
cd apps/web && bun run typecheck
```

Expected: No errors in `intro-layout.tsx`

---

### Task 3: Update Intro server component

**Files:**
- Modify: `apps/web/components/sections/intro.tsx`

- [ ] **Step 1: Replace intro.tsx with thin server shell**

Replace the entire contents of `apps/web/components/sections/intro.tsx` with:

```tsx
import { getIntroData } from "@/lib/queries";
import { IntroLayout } from "./intro-layout";

export async function Intro() {
  const { summary, metrics } = await getIntroData();

  if (!summary) {
    return null;
  }

  return <IntroLayout summary={summary} metrics={metrics} />;
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd apps/web && bun run typecheck
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/sections/intro.tsx apps/web/components/sections/intro-layout.tsx
git commit -m "feat: pretext-powered intro layout with badge-aware line breaks"
```

---

### Task 4: Visual verification

- [ ] **Step 1: Start the dev server**

```bash
bun run dev:web
```

- [ ] **Step 2: Open the site and verify the intro section**

```bash
cmux browser open http://localhost:3000
cmux browser wait --load-state complete
cmux browser snapshot
```

Check:
- Drop cap "A" renders as a large letter on the left
- Text flows around it — first few lines are indented
- Badges render inline with the `#f0ecdf` background
- No badges break across lines
- Text is readable and properly spaced
- On narrow widths, lines re-break correctly

- [ ] **Step 3: Test resize behaviour**

```bash
cmux browser resize --width 600 --height 800
cmux browser snapshot
```

Check: Lines re-flow correctly at narrow width, drop cap still works.

- [ ] **Step 4: Run lint**

```bash
bun run check
```

Fix any issues with `bun run fix`.

- [ ] **Step 5: Final commit (if lint fixes needed)**

```bash
git add -A
git commit -m "fix: lint fixes for pretext intro"
```

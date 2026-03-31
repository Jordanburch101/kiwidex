"use client";

import type { PreparedTextWithSegments } from "@chenglou/pretext";
import { layoutNextLine, prepareWithSegments } from "@chenglou/pretext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Badge padding adds ~12px total width (6px each side from px-1.5)
const BADGE_EXTRA_PX = 12;
// Gap between drop cap and text
const DROP_CAP_GAP = 12;
// Regex matching metric placeholders in summary text
const BADGE_RE = /\{(ocr|cpi|nzd_usd|petrol_91|unemployment|wage_growth)\}/g;

type Part = { type: "text"; value: string } | { type: "badge"; value: string };

interface LayoutLine {
  indented: boolean;
  parts: Part[];
}

interface IntroLayoutProps {
  metrics: Record<string, string>;
  summary: string;
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
function splitLineIntoParts(
  lineText: string,
  badgeValues: Set<string>
): Part[] {
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
    if (lineText.includes(value)) {
      count++;
    }
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
    if (line === null) {
      break;
    }

    // Check if badges in this line cause overflow
    const badgeCount = countBadges(line.text, badgeValues);
    if (badgeCount > 0) {
      const extraWidth = badgeCount * BADGE_EXTRA_PX;
      if (line.width + extraWidth > baseWidth) {
        // Re-layout with reduced width to account for badge padding
        const adjusted = layoutNextLine(
          prepared,
          cursor,
          baseWidth - extraWidth
        );
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

function renderPart(part: Part, j: number) {
  if (part.type === "badge") {
    return (
      <span
        className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]"
        key={j}
        style={{ whiteSpace: "nowrap" }}
      >
        {part.value}
      </span>
    );
  }
  return <span key={j}>{part.value}</span>;
}

function renderLine(line: LayoutLine, i: number, dropCapWidth: number) {
  return (
    <div
      key={i}
      style={
        line.indented
          ? { marginLeft: `${dropCapWidth + DROP_CAP_GAP}px` }
          : undefined
      }
    >
      {line.parts.map(renderPart)}
    </div>
  );
}

export function IntroLayout({ summary, metrics }: IntroLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropCapRef = useRef<HTMLSpanElement>(null);
  const [lines, setLines] = useState<LayoutLine[]>([]);
  const [ready, setReady] = useState(false);
  const [dropCapWidthPx, setDropCapWidthPx] = useState(52);

  const { fullText, dropCap, badgeValues } = useMemo(
    () => buildFullText(summary, metrics),
    [summary, metrics]
  );

  // Store prepared text (expensive, only recompute when text changes)
  const preparedRef = useRef<PreparedTextWithSegments | null>(null);
  const prevTextRef = useRef<string>("");

  const doLayout = useCallback(() => {
    const container = containerRef.current;
    const dropCapEl = dropCapRef.current;
    if (!(container && dropCapEl)) {
      return;
    }

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
    setDropCapWidthPx(dropCapWidth);
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
    if (!container) {
      return;
    }

    const observer = new ResizeObserver(() => doLayout());
    observer.observe(container);
    return () => observer.disconnect();
  }, [doLayout]);

  return (
    <section aria-label="Economic summary" className="px-6">
      <div className="border-[#e5e0d5] border-b pb-6">
        <div
          className="relative"
          ref={containerRef}
          style={{ visibility: ready ? "visible" : "hidden" }}
        >
          {/* Drop cap — absolutely positioned in its own element */}
          <span
            className="absolute top-0 left-0 font-bold font-heading text-[#2a2520] text-[68px]"
            ref={dropCapRef}
            style={{ lineHeight: "0.85" }}
          >
            {dropCap}
          </span>

          {/* Lines laid out by pretext */}
          <div className="text-[#444038] text-[13.5px] leading-[1.75]">
            {lines.map((line, i) => renderLine(line, i, dropCapWidthPx))}
          </div>
        </div>

        {/* Fallback for SSR — plain text, hidden once layout is ready */}
        {!ready && (
          <p
            aria-hidden
            className="text-[#444038] text-[13.5px] leading-[1.75]"
          >
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

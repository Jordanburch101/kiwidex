"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DataPoint {
  date: string;
  value: number;
}

export interface HorizonRow {
  color: string;
  data: DataPoint[];
  key: string;
  label: string;
}

export interface HorizonChartProps {
  rows: HorizonRow[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIME_RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
] as const;

type RangeLabel = (typeof TIME_RANGES)[number]["label"];

const BANDS = 3;

const T = {
  border: "#e8e4dc",
  bg: "white",
  heading: "#2a2520",
  btnBorder: "#e5e0d5",
  text: "#555",
  muted: "#998",
  rowBg: "#faf8f4",
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStartDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0]!;
}

function normalise(data: DataPoint[], startDate: string): DataPoint[] {
  const filtered = data.filter((d) => d.date >= startDate);
  const baseline = filtered[0]?.value;
  if (!baseline) {
    return [];
  }
  return filtered.map((d) => ({
    date: d.date,
    value: ((d.value - baseline) / baseline) * 100,
  }));
}

function formatDateShort(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function formatDateAxis(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString("en-NZ", { month: "short", year: "2-digit" });
}

function hexToRgb(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// Animation helpers
// ---------------------------------------------------------------------------

type ProcessedRow = {
  label: string;
  color: string;
  data: DataPoint[];
  change: number;
};

const ANIM_SAMPLES = 120;
const ANIM_DURATION = 400;

/** Resample a data series to exactly N evenly-spaced points via linear interp */
function resample(data: DataPoint[], n: number): number[] {
  if (data.length === 0) {
    return new Array(n).fill(0);
  }
  if (data.length === 1) {
    return new Array(n).fill(data[0]!.value);
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const frac = i / (n - 1);
    const pos = frac * (data.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, data.length - 1);
    const t = pos - lo;
    out.push(data[lo]!.value * (1 - t) + data[hi]!.value * t);
  }
  return out;
}

/** Lerp two number arrays element-wise */
function lerpArrays(a: number[], b: number[], t: number): number[] {
  const out: number[] = [];
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    out.push(va + (vb - va) * t);
  }
  return out;
}

/** Ease-out cubic */
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

interface DrawParams {
  ctx: CanvasRenderingContext2D;
  dpr: number;
  height: number;
  hoverIndex: number | null;
  hoverX: number | null;
  rows: { label: string; color: string; data: DataPoint[]; change: number }[];
  width: number;
}

function draw({
  ctx,
  rows,
  width,
  height,
  dpr,
  hoverIndex,
  hoverX,
}: DrawParams) {
  const padding = { left: 90, right: 16, top: 0, bottom: 24 };
  const chartW = width - padding.left - padding.right;
  const rowGap = 4;
  const rowH = (height - padding.top - padding.bottom) / rows.length - rowGap;

  ctx.clearRect(0, 0, width * dpr, height * dpr);
  ctx.save();
  ctx.scale(dpr, dpr);

  // Time axis labels
  if (rows[0] && rows[0].data.length > 0) {
    const data = rows[0].data;
    ctx.fillStyle = T.muted;
    ctx.font = "10px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";

    const labelCount = Math.min(6, data.length);
    for (let i = 0; i < labelCount; i++) {
      const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
      const x = padding.left + (idx / (data.length - 1)) * chartW;
      ctx.fillText(formatDateAxis(data[idx]!.date), x, height - 6);
    }
  }

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]!;
    const y0 = padding.top + ri * (rowH + rowGap);
    const data = row.data;
    const [cr, cg, cb] = hexToRgb(row.color);

    if (data.length === 0) {
      continue;
    }

    const maxAbs = Math.max(...data.map((d) => Math.abs(d.value)), 0.01);

    // Row background
    ctx.fillStyle = ri % 2 === 0 ? "white" : T.rowBg;
    ctx.fillRect(padding.left, y0, chartW, rowH);

    // Draw horizon bands
    for (let b = BANDS; b >= 1; b--) {
      ctx.beginPath();
      ctx.moveTo(padding.left, y0 + rowH);

      for (let i = 0; i < data.length; i++) {
        const x = padding.left + (i / (data.length - 1)) * chartW;
        const normVal = Math.abs(data[i]!.value) / maxAbs;
        const bandVal = Math.min(1, Math.max(0, normVal * BANDS - (b - 1)));
        const cy = y0 + rowH - bandVal * rowH;
        ctx.lineTo(x, cy);
      }

      ctx.lineTo(padding.left + chartW, y0 + rowH);
      ctx.closePath();

      const alpha = 0.12 + (b / BANDS) * 0.5;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.fill();
    }

    // Top stroke
    ctx.strokeStyle = row.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const normVal = Math.abs(data[i]!.value) / maxAbs;
      const cy = y0 + rowH - normVal * rowH;
      i === 0 ? ctx.moveTo(x, cy) : ctx.lineTo(x, cy);
    }
    ctx.stroke();

    // Labels (left side)
    ctx.fillStyle = T.heading;
    ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(row.label, padding.left - 12, y0 + rowH / 2 - 2);

    // Change value
    const sign = row.change >= 0 ? "+" : "";
    ctx.fillStyle = T.muted;
    ctx.font = "10px ui-monospace, SFMono-Regular, monospace";
    ctx.textAlign = "right";
    ctx.fillText(
      `${sign}${row.change.toFixed(1)}%`,
      padding.left - 12,
      y0 + rowH / 2 + 12
    );

    // Hover crosshair
    if (
      hoverX !== null &&
      hoverIndex !== null &&
      hoverX >= padding.left &&
      hoverX <= padding.left + chartW
    ) {
      // Vertical line
      ctx.strokeStyle = `${T.border}`;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot on hovered row
      const dataIdx = Math.round(
        ((hoverX - padding.left) / chartW) * (data.length - 1)
      );
      const clampedIdx = Math.max(0, Math.min(data.length - 1, dataIdx));

      for (let r = 0; r < rows.length; r++) {
        const rd = rows[r]!;
        if (rd.data.length === 0) {
          continue;
        }
        const rIdx = Math.max(0, Math.min(rd.data.length - 1, clampedIdx));
        const rMaxAbs = Math.max(
          ...rd.data.map((d) => Math.abs(d.value)),
          0.01
        );
        const rNorm = Math.abs(rd.data[rIdx]!.value) / rMaxAbs;
        const ry0 = padding.top + r * (rowH + rowGap);
        const dotY = ry0 + rowH - rNorm * rowH;
        const dotX = padding.left + (rIdx / (rd.data.length - 1)) * chartW;

        ctx.beginPath();
        ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = rd.color;
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function HorizonChart({ rows: rawRows }: HorizonChartProps) {
  const [range, setRange] = useState<RangeLabel>("90D");

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({
    w: 0,
    h: 0,
    dpr: 1,
  });
  const prevSamplesRef = useRef<number[][] | null>(null);
  const animFrameRef = useRef<number>(0);
  const currentRowsRef = useRef<ProcessedRow[]>([]);

  const rangeDays = TIME_RANGES.find((r) => r.label === range)?.days ?? 90;
  const startDate = useMemo(() => getStartDate(rangeDays), [rangeDays]);

  const processedRows = useMemo(() => {
    return rawRows.map((row) => {
      const normed = normalise(row.data, startDate);
      const lastVal = normed.length > 0 ? normed[normed.length - 1]!.value : 0;
      return {
        label: row.label,
        color: row.color,
        data: normed,
        change: lastVal,
      };
    });
  }, [rawRows, startDate]);

  const padding = { left: 90, right: 16 };

  // Size the canvas — only called on mount/resize, not on hover
  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!(canvas && container)) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    sizeRef.current = { w: rect.width, h: rect.height, dpr };
  }, []);

  // Draw with explicit row data — used by both static and animated draws
  const drawRows = useCallback(
    (rows: ProcessedRow[], hoverX: number | null, hoverIdx: number | null) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      const { w, h, dpr } = sizeRef.current;
      if (w === 0) {
        return;
      }

      draw({
        ctx,
        rows,
        width: w,
        height: h,
        dpr,
        hoverIndex: hoverIdx,
        hoverX,
      });
    },
    []
  );

  // Redraw current state — for hover etc.
  const redraw = useCallback(
    (hoverX: number | null, hoverIdx: number | null) => {
      drawRows(currentRowsRef.current, hoverX, hoverIdx);
    },
    [drawRows]
  );

  // Animate transition when processedRows changes
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);

    const newSamples = processedRows.map((r) => resample(r.data, ANIM_SAMPLES));
    const oldSamples = prevSamplesRef.current;

    // No previous data — draw immediately (first render)
    if (!oldSamples || oldSamples.length !== newSamples.length) {
      currentRowsRef.current = processedRows;
      prevSamplesRef.current = newSamples;
      syncSize();
      drawRows(processedRows, null, null);
      return;
    }

    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const t = Math.min(1, elapsed / ANIM_DURATION);
      const eased = easeOut(t);

      // Build interpolated rows
      const interpRows: ProcessedRow[] = processedRows.map((row, i) => {
        const lerped = lerpArrays(oldSamples[i]!, newSamples[i]!, eased);
        const interpData = lerped.map((v, j) => ({
          date:
            row.data[
              Math.round(
                (j / (ANIM_SAMPLES - 1)) * Math.max(0, row.data.length - 1)
              )
            ]?.date ?? "",
          value: v,
        }));
        const lastChange =
          row.change * eased +
          (oldSamples[i]![oldSamples[i]!.length - 1] ?? 0) * (1 - eased);
        return { ...row, data: interpData, change: lastChange };
      });

      currentRowsRef.current = interpRows;
      drawRows(interpRows, null, null);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Animation complete — store final state
        currentRowsRef.current = processedRows;
        prevSamplesRef.current = newSamples;
      }
    }

    animFrameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [processedRows, syncSize, drawRows]);

  // Resize observer (separate from animation)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(() => {
      syncSize();
      drawRows(currentRowsRef.current, null, null);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [syncSize, drawRows]);

  const updateTooltip = useCallback(
    (x: number, y: number, fraction: number) => {
      const tip = tooltipRef.current;
      if (!tip) {
        return;
      }

      // Find a date label from the row with the most data points
      let dateLabel = "";
      for (const row of processedRows) {
        if (row.data.length === 0) {
          continue;
        }
        const idx = Math.round(fraction * (row.data.length - 1));
        const d = row.data[idx]?.date;
        if (d) {
          dateLabel = formatDateShort(d);
          break;
        }
      }
      if (!dateLabel) {
        tip.style.display = "none";
        return;
      }

      let html = `<div style="font-weight:500;margin-bottom:4px">${dateLabel}</div>`;
      for (const row of processedRows) {
        if (row.data.length === 0) {
          continue;
        }
        const idx = Math.round(fraction * (row.data.length - 1));
        const val = row.data[idx]?.value ?? 0;
        const sign = val >= 0 ? "+" : "";
        html += `<div style="display:flex;align-items:center;gap:8px;padding:2px 0">`;
        html += `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${row.color};flex-shrink:0"></span>`;
        html += `<span style="color:#71717a">${row.label}</span>`;
        html += `<span style="margin-left:auto;font-weight:500;font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums">${sign}${val.toFixed(1)}%</span>`;
        html += "</div>";
      }

      tip.innerHTML = html;
      tip.style.display = "block";
      tip.style.left = `${x + 12}px`;
      tip.style.top = `${y - 10}px`;
    },
    [processedRows]
  );

  const hideTooltip = useCallback(() => {
    const tip = tooltipRef.current;
    if (tip) {
      tip.style.display = "none";
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = containerRef.current;
      if (!container || processedRows.length === 0) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const chartW = rect.width - padding.left - padding.right;

      if (x < padding.left || x > padding.left + chartW) {
        hideTooltip();
        redraw(null, null);
        return;
      }

      const fraction = (x - padding.left) / chartW;
      const maxLen = Math.max(...processedRows.map((r) => r.data.length));
      const dataIndex = Math.round(fraction * (maxLen - 1));

      updateTooltip(x, y, fraction);
      redraw(x, dataIndex);
    },
    [
      processedRows,
      redraw,
      padding.left,
      padding.right,
      updateTooltip,
      hideTooltip,
    ]
  );

  const handleMouseLeave = useCallback(() => {
    hideTooltip();
    redraw(null, null);
  }, [redraw, hideTooltip]);

  return (
    <div
      className="flex flex-col rounded-lg border p-4"
      style={{ borderColor: T.border, backgroundColor: T.bg }}
    >
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <h2
          className="font-heading font-semibold text-sm"
          style={{ color: T.heading }}
        >
          Cost of Living Trends
        </h2>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                range === r.label ? "text-white" : "border"
              }`}
              key={r.label}
              onClick={() => setRange(r.label)}
              style={
                range === r.label
                  ? { backgroundColor: T.heading }
                  : { borderColor: T.btnBorder, color: T.text }
              }
              type="button"
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-xs" style={{ color: T.muted }}>
        Showing % change from start of period
      </p>

      {/* Chart */}
      <div
        className="relative min-h-0 flex-1 cursor-crosshair overflow-visible"
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        ref={containerRef}
      >
        <canvas className="pointer-events-none" ref={canvasRef} />
        <div
          className="pointer-events-none absolute z-10 hidden rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl"
          ref={tooltipRef}
        />
      </div>
    </div>
  );
}

"use client";

import { Sparkline } from "@workspace/ui/components/sparkline";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TickerItemProps {
  label: string;
  value: string;
  sparklineData: number[];
  color?: string;
}

function TooltipPortal({
  anchor,
  label,
  change,
  last30,
  color,
}: {
  anchor: DOMRect;
  label: string;
  change: number | null;
  last30: number[];
  color: string;
}) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!tooltipRef.current) return;
    const tw = tooltipRef.current.offsetWidth;
    let left = anchor.left + anchor.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    const top = anchor.top - tooltipRef.current.offsetHeight - 8;
    setPos({ top, left });
  }, [anchor]);

  return createPortal(
    <motion.div
      ref={tooltipRef}
      className="pointer-events-none fixed z-50 origin-bottom rounded-lg border border-[#e5e0d5] bg-[#faf8f4] p-3 shadow-lg"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
      initial={{ opacity: 0, y: 6, scale: 0.9 }}
      animate={{ opacity: pos ? 1 : 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <span className="font-medium text-[#2a2520] text-xs">{label}</span>
        {change !== null && (
          <span
            className={`text-[10px] font-mono font-semibold ${change >= 0 ? "text-emerald-600" : "text-red-500"}`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}%
          </span>
        )}
      </div>
      <Sparkline
        color={color}
        data={last30}
        fill
        height={48}
        strokeWidth={1.5}
        width={140}
      />
      <div className="mt-1 flex justify-between text-[9px] text-[#998]">
        <span>30d ago</span>
        <span>now</span>
      </div>
    </motion.div>,
    document.body
  );
}

export function TickerItem({
  label,
  value,
  sparklineData,
  color = "#888",
}: TickerItemProps) {
  const [hovered, setHovered] = useState(false);
  const itemRef = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const last30 = sparklineData.slice(-30);

  const first = last30[0];
  const last = last30[last30.length - 1];
  const change =
    first != null && last != null && first !== 0
      ? ((last - first) / Math.abs(first)) * 100
      : null;

  return (
    <span
      ref={itemRef}
      className="inline-flex items-center gap-2 whitespace-nowrap px-4"
      onPointerEnter={() => {
        setHovered(true);
        if (itemRef.current) setRect(itemRef.current.getBoundingClientRect());
      }}
      onPointerLeave={() => setHovered(false)}
    >
      <span className="text-[#998] text-xs">{label}</span>
      <span className="font-semibold text-[#2a2520] text-sm">{value}</span>
      <Sparkline
        color={color}
        data={sparklineData}
        height={16}
        strokeWidth={1}
        width={48}
      />

      <AnimatePresence>
        {hovered && rect && last30.length >= 2 && (
          <TooltipPortal
            anchor={rect}
            change={change}
            color={color}
            label={label}
            last30={last30}
          />
        )}
      </AnimatePresence>
    </span>
  );
}

"use client";

import type { ReactNode } from "react";

interface MarqueeProps {
  children: ReactNode;
  speed?: number;
}

export function Marquee({ children, speed = 40 }: MarqueeProps) {
  return (
    <div className="group relative overflow-hidden border-b border-[#e5e0d5] bg-[#f5f3ee]">
      <div
        className="flex w-max animate-[marquee_var(--marquee-speed)_linear_infinite] group-hover:[animation-play-state:paused]"
        style={
          { "--marquee-speed": `${speed}s` } as React.CSSProperties
        }
      >
        <div className="flex items-center py-2">{children}</div>
        <div className="flex items-center py-2" aria-hidden="true">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

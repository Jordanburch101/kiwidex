"use client";

import Image from "next/image";
import { useState } from "react";
import { parseSources, SOURCE_INFO } from "@/lib/sources";

export function SourceLogos({
  size,
  sources,
}: {
  size: number;
  sources: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const all = parseSources(sources);
  const known = all.filter((s) => SOURCE_INFO[s.toLowerCase()]);
  if (known.length === 0) {
    return null;
  }

  const MAX_VISIBLE = 5;
  const visible = known.slice(0, MAX_VISIBLE);
  const hidden = known.slice(MAX_VISIBLE);
  const overflow = hidden.length;

  return (
    <div
      className="flex items-center"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {visible.map((source, idx) => {
        const info = SOURCE_INFO[source.toLowerCase()]!;
        return (
          <div
            className="relative overflow-hidden rounded-md border-2 border-[#fdfcf9]"
            key={source}
            style={{
              width: size,
              height: size,
              marginLeft: idx === 0 ? 0 : hovered ? 1 : -6,
              zIndex: visible.length - idx,
              transition: "margin-left 280ms cubic-bezier(0.34, 1.56, 0.64, 1)",
              transitionDelay: `${idx * 25}ms`,
            }}
          >
            <Image
              alt={info.label}
              className="object-cover"
              fill
              sizes={`${size}px`}
              src={info.logo}
            />
          </div>
        );
      })}
      {overflow > 0 && (
        <>
          {hidden.map((source, idx) => {
            const info = SOURCE_INFO[source.toLowerCase()]!;
            const delay = (visible.length + idx) * 25;
            return (
              <div
                className="relative overflow-hidden rounded-md border-2 border-[#fdfcf9]"
                key={source}
                style={{
                  width: hovered ? size : 0,
                  height: size,
                  marginLeft: hovered ? 1 : -6,
                  zIndex: 0,
                  opacity: hovered ? 1 : 0,
                  transform: hovered ? "scale(1)" : "scale(0.6)",
                  transition:
                    "width 280ms cubic-bezier(0.34, 1.56, 0.64, 1), margin-left 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease, transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transitionDelay: hovered ? `${delay}ms` : "0ms",
                }}
              >
                <Image
                  alt={info.label}
                  className="object-cover"
                  fill
                  sizes={`${size}px`}
                  src={info.logo}
                />
              </div>
            );
          })}
          <div
            className="flex items-center justify-center rounded-md border-2 border-[#fdfcf9] bg-[#e8e3d9] font-sans font-bold text-[#2a2520]"
            style={{
              width: size,
              height: size,
              marginLeft: 0,
              zIndex: 0,
              fontSize: size * 0.4,
              opacity: hovered ? 0 : 1,
              transform: hovered ? "scale(0.6)" : "scale(1)",
              transition:
                "opacity 150ms ease, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            +{overflow}
          </div>
        </>
      )}
    </div>
  );
}

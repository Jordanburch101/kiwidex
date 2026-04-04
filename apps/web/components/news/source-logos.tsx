import Image from "next/image";
import { parseSources, SOURCE_INFO } from "@/lib/sources";

export function SourceLogos({
  size,
  sources,
}: {
  size: number;
  sources: string | null;
}) {
  const all = parseSources(sources);
  const known = all.filter((s) => SOURCE_INFO[s.toLowerCase()]);
  if (known.length === 0) {
    return null;
  }

  const MAX_VISIBLE = 5;
  const visible = known.slice(0, MAX_VISIBLE);
  const overflow = known.length - MAX_VISIBLE;

  return (
    <div className="flex items-center">
      {visible.map((source, idx) => {
        const info = SOURCE_INFO[source.toLowerCase()]!;
        return (
          <div
            className="relative overflow-hidden rounded-md border-2 border-[#fdfcf9]"
            key={source}
            style={{
              width: size,
              height: size,
              marginLeft: idx === 0 ? 0 : -6,
              zIndex: visible.length - idx,
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
        <div
          className="flex items-center justify-center rounded-md border-2 border-[#fdfcf9] bg-[#e8e3d9] font-sans font-bold text-[#2a2520]"
          style={{
            width: size,
            height: size,
            marginLeft: -6,
            zIndex: 0,
            fontSize: size * 0.4,
          }}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

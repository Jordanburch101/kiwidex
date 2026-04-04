import { SOURCE_INFO } from "@/lib/sources";

export function SourceBadge({ source }: { source: string }) {
  const badge = SOURCE_INFO[source.toLowerCase()];
  if (!badge) {
    return (
      <span className="rounded bg-[#555] px-2 py-0.5 font-sans font-bold text-[9px] text-white tracking-wide">
        {source}
      </span>
    );
  }
  return (
    <span
      className="rounded px-2 py-0.5 font-sans font-bold text-[9px] text-white tracking-wide"
      style={{ backgroundColor: badge.bg }}
    >
      {badge.label}
    </span>
  );
}

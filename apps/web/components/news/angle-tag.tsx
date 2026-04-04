const ANGLE_STYLES: Record<string, string> = {
  "Policy focus": "bg-[#ede9fe] text-[#6d28d9]",
  "Consumer impact": "bg-[#fef3c7] text-[#92400e]",
  "Market analysis": "bg-[#e0f2fe] text-[#0369a1]",
  "Human interest": "bg-[#fce7f3] text-[#9d174d]",
  "Data-driven": "bg-[#ecfdf5] text-[#065f46]",
  "Industry perspective": "bg-[#f5f3ff] text-[#5b21b6]",
};

export function AngleTag({ angle }: { angle: string }) {
  const style = ANGLE_STYLES[angle] ?? "bg-[#f0f0f0] text-[#555]";
  return (
    <span
      className={`rounded px-2 py-0.5 font-sans font-semibold text-[10px] ${style}`}
    >
      {angle}
    </span>
  );
}

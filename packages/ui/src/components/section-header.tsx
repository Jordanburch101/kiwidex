interface SectionHeaderProps {
  subtitle?: string;
  title: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6 flex items-baseline justify-between border-[#2a2520] border-b-2 pb-2">
      <h2 className="font-heading font-semibold text-2xl text-[#2a2520]">
        {title}
      </h2>
      {subtitle && <span className="text-[#998] text-xs">{subtitle}</span>}
    </div>
  );
}

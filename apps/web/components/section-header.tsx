interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between border-b-2 border-[#2a2520] pb-2 mb-6">
      <h2 className="font-heading text-2xl font-semibold text-[#2a2520]">
        {title}
      </h2>
      {subtitle && (
        <span className="text-xs text-[#998]">{subtitle}</span>
      )}
    </div>
  );
}

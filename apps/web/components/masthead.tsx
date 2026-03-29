interface MastheadProps {
  lastUpdated?: string;
}

export function Masthead({ lastUpdated }: MastheadProps) {
  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="border-b-2 border-[#2a2520] pb-4 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#998]">
        The New Zealand Economy
      </p>
      <h1 className="mt-1 font-heading text-5xl font-bold text-[#2a2520]">
        Economic Pulse
      </h1>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-[#998]">
        <span>{today}</span>
        {lastUpdated && (
          <>
            <span className="text-[#ccc]">|</span>
            <span>Last updated: {lastUpdated}</span>
          </>
        )}
      </div>
    </header>
  );
}

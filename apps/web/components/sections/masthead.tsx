export function Masthead() {
  const today = new Date().toLocaleDateString("en-NZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <header className="pb-4 text-center">
      <p className="font-medium text-[#998] text-xs uppercase tracking-[0.3em]">
        The New Zealand Economy
      </p>
      <h1 className="mt-1 font-bold font-heading text-5xl text-[#2a2520]">
        The Kiwidex
      </h1>
      <p className="mt-2 text-[#998] text-xs">{today}</p>
    </header>
  );
}

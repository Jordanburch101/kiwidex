import { SponsorForm } from "@/components/sponsor-form";

export function SponsorCTA() {
  return (
    <section className="px-6 py-10">
      <div className="flex flex-col items-center text-center">
        <span className="mb-3 inline-block border-[#e5e0d5] border-b pb-1 font-semibold text-[#998] text-[9px] uppercase tracking-[0.25em]">
          Sponsorship
        </span>
        <h2 className="font-bold font-heading text-2xl text-[#2a2520]">
          Reach New Zealand's Economy Watchers
        </h2>
        <p className="mt-2 max-w-[420px] text-[#998] text-xs leading-relaxed">
          Thousands of professionals, investors, and decision-makers check this
          dashboard weekly. Put your brand where the data is.
        </p>
        <div className="mt-5">
          <SponsorForm />
        </div>
      </div>
    </section>
  );
}

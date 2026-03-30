import { NewsletterForm } from "@/components/newsletter-form";

export function Footer() {
  return (
    <footer className="border-[#2a2520] border-t-2">
      {/* Newsletter band */}
      <div className="flex flex-col items-center gap-6 border-[#e5e0d5] border-b px-6 py-8 sm:flex-row sm:justify-between sm:px-12">
        <div className="text-center sm:text-left">
          <h3 className="font-bold font-heading text-[#2a2520] text-xl">
            Stay Across the Numbers
          </h3>
          <p className="mt-1 text-[#998] text-[12.5px]">
            Weekly briefing on what moved in the NZ economy — data, not
            opinions.
          </p>
        </div>
        <NewsletterForm />
      </div>

      {/* Three-column info grid */}
      <div className="grid grid-cols-1 border-[#e5e0d5] border-b sm:grid-cols-3">
        {/* About */}
        <div className="border-[#e5e0d5] border-b px-6 py-7 sm:border-r sm:border-b-0 sm:px-12">
          <h4 className="mb-3.5 border-[#e5e0d5] border-b pb-2 font-semibold text-[#998] text-[9px] uppercase tracking-[0.25em]">
            About This Project
          </h4>
          <p className="text-[#777] text-[11.5px] leading-[1.7]">
            The Kiwidex tracks New Zealand's key economic indicators in one
            place. Data is collected daily from public sources and presented
            without commentary — a dashboard for anyone who wants to see what's
            actually happening.
          </p>
          <p className="mt-3 text-[11.5px]">
            Built by{" "}
            <a
              className="border-[#d5d0c5] border-b text-[#2a2520] no-underline transition-colors hover:border-[#2a2520]"
              href="https://jordanburch.dev"
              rel="noopener noreferrer"
              target="_blank"
            >
              Jordan Burch
            </a>
          </p>
        </div>

        {/* Data Sources */}
        <div className="border-[#e5e0d5] border-b px-6 py-7 sm:border-r sm:border-b-0 sm:px-12">
          <h4 className="mb-3.5 border-[#e5e0d5] border-b pb-2 font-semibold text-[#998] text-[9px] uppercase tracking-[0.25em]">
            Data Sources
          </h4>
          <ul className="space-y-1.5">
            <SourceRow detail="OCR, FX, Mortgages" name="Reserve Bank (RBNZ)" />
            <SourceRow detail="CPI, GDP, Employment" name="Stats NZ" />
            <SourceRow detail="Fuel, Min. wage" name="MBIE" />
            <SourceRow detail="House prices" name="REINZ" />
            <SourceRow detail="Grocery prices" name="Supermarkets" />
            <SourceRow detail="Power prices" name="Electricity Authority" />
          </ul>
        </div>

        {/* Update Schedule */}
        <div className="px-6 py-7 sm:px-12">
          <h4 className="mb-3.5 border-[#e5e0d5] border-b pb-2 font-semibold text-[#998] text-[9px] uppercase tracking-[0.25em]">
            Update Schedule
          </h4>
          <ul className="space-y-1.5">
            <SourceRow detail="Daily" name="Fuel & groceries" />
            <SourceRow detail="Daily" name="Exchange rates" />
            <SourceRow detail="Daily" name="Electricity" />
            <SourceRow detail="Weekly" name="Mortgage rates" />
            <SourceRow detail="Monthly" name="House prices" />
            <SourceRow detail="Quarterly" name="CPI, GDP, Employment" />
          </ul>
        </div>
      </div>

      {/* Colophon */}
      <div className="flex flex-col items-center gap-3 px-6 py-5 sm:flex-row sm:justify-between sm:px-12">
        <p className="text-center text-[#bbb] text-[10px] leading-relaxed sm:text-left">
          Data collected from public sources.
          <br />
          May not reflect real-time values.
        </p>
        <p className="font-bold font-heading text-[#d5d0c5] text-sm tracking-[0.05em]">
          The Kiwidex
        </p>
        <p className="text-[10px]">
          <a
            className="border-transparent border-b text-[#998] no-underline transition-colors hover:border-[#998]"
            href="https://jordanburch.dev"
            rel="noopener noreferrer"
            target="_blank"
          >
            jordanburch.dev
          </a>
        </p>
      </div>
    </footer>
  );
}

function SourceRow({ name, detail }: { name: string; detail: string }) {
  return (
    <li className="flex items-baseline justify-between">
      <span className="text-[#555] text-[11.5px]">{name}</span>
      <span className="text-[#bbb] text-[10px] italic">{detail}</span>
    </li>
  );
}

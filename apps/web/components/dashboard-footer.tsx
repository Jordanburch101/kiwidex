export function DashboardFooter() {
  return (
    <footer className="border-t border-[#e5e0d5] py-8">
      <div className="grid grid-cols-1 gap-6 text-xs text-[#998] sm:grid-cols-2">
        <div>
          <h4 className="mb-2 font-medium uppercase tracking-wider text-[#777]">
            Data Sources
          </h4>
          <ul className="space-y-1">
            <li>Reserve Bank of New Zealand (RBNZ) - OCR, Exchange rates</li>
            <li>Stats NZ - CPI, GDP, Employment, Income</li>
            <li>MBIE - Fuel prices, Minimum wage</li>
            <li>Supermarket websites - Grocery prices</li>
            <li>Interest.co.nz - Mortgage rates</li>
            <li>REINZ - House prices</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 font-medium uppercase tracking-wider text-[#777]">
            Update Frequency
          </h4>
          <ul className="space-y-1">
            <li>Fuel & grocery prices: Daily</li>
            <li>Exchange rates: Daily</li>
            <li>Mortgage rates: Weekly</li>
            <li>CPI, GDP, Employment: Quarterly</li>
            <li>House prices: Monthly</li>
          </ul>
        </div>
      </div>
      <p className="mt-6 text-center text-[10px] text-[#bbb]">
        NZ Economy Dashboard. Data is collected from public sources and may not
        reflect real-time values.
      </p>
    </footer>
  );
}

export function Footer() {
  return (
    <footer className="border-[#e5e0d5] border-t px-6 py-8">
      <div className="grid grid-cols-1 gap-6 text-[#998] text-xs sm:grid-cols-2">
        <div>
          <h4 className="mb-2 font-medium text-[#777] uppercase tracking-wider">
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
          <h4 className="mb-2 font-medium text-[#777] uppercase tracking-wider">
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
      <p className="mt-6 text-center text-[#bbb] text-[10px]">
        NZ Economy Dashboard. Data is collected from public sources and may not
        reflect real-time values.
      </p>
    </footer>
  );
}

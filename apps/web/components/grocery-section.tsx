import { SectionHeader } from "./section-header";
import { AreaChartSection } from "./deep-dive-chart";

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface GrocerySectionProps {
  milk: TimeSeriesPoint[];
  eggs: TimeSeriesPoint[];
  bread: TimeSeriesPoint[];
  butter: TimeSeriesPoint[];
  cheese: TimeSeriesPoint[];
}

const GROCERY_COLORS = {
  milk: "oklch(0.845 0.143 164.978)",
  eggs: "oklch(0.696 0.17 162.48)",
  bread: "oklch(0.596 0.145 163.225)",
  butter: "oklch(0.508 0.118 165.612)",
  cheese: "oklch(0.432 0.095 166.913)",
};

export function GrocerySection({
  milk,
  eggs,
  bread,
  butter,
  cheese,
}: GrocerySectionProps) {
  const items = [
    { label: "Milk (2L)", data: milk, color: GROCERY_COLORS.milk },
    { label: "Eggs (Dozen)", data: eggs, color: GROCERY_COLORS.eggs },
    { label: "Bread (Loaf)", data: bread, color: GROCERY_COLORS.bread },
    { label: "Butter (500g)", data: butter, color: GROCERY_COLORS.butter },
    { label: "Cheese (1kg)", data: cheese, color: GROCERY_COLORS.cheese },
  ];

  return (
    <section className="py-10">
      <SectionHeader
        title="Grocery Prices"
        subtitle="Daily averages across supermarkets"
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <h4 className="mb-2 text-sm font-medium text-[#555]">
              {item.label}
            </h4>
            <AreaChartSection
              data={item.data}
              color={item.color}
              height={160}
              valueFormat="currency"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

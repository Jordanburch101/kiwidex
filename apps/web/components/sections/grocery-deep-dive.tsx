import { SectionHeader } from "@workspace/ui/components/section-header";
import { AreaChartSection } from "@/components/charts/area-chart";
import { getGroceryChartData } from "@/lib/queries";

const GROCERY_COLORS = {
  milk: "oklch(0.845 0.143 164.978)",
  eggs: "oklch(0.696 0.17 162.48)",
  bread: "oklch(0.596 0.145 163.225)",
  butter: "oklch(0.508 0.118 165.612)",
  cheese: "oklch(0.432 0.095 166.913)",
  bananas: "#d4a017",
};

export async function GroceryDeepDive() {
  const { milk, eggs, bread, butter, cheese, bananas } =
    await getGroceryChartData();

  const items = [
    { label: "Milk (2L)", data: milk, color: GROCERY_COLORS.milk },
    { label: "Eggs (Dozen)", data: eggs, color: GROCERY_COLORS.eggs },
    { label: "Bread (Loaf)", data: bread, color: GROCERY_COLORS.bread },
    { label: "Butter (500g)", data: butter, color: GROCERY_COLORS.butter },
    { label: "Cheese (1kg)", data: cheese, color: GROCERY_COLORS.cheese },
    { label: "Bananas (kg)", data: bananas, color: GROCERY_COLORS.bananas },
  ];

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Daily averages across supermarkets"
        title="Grocery Prices"
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <h4 className="mb-2 font-medium text-[#555] text-sm">
              {item.label}
            </h4>
            <AreaChartSection
              color={item.color}
              data={item.data}
              height={160}
              valueFormat="currency"
            />
          </div>
        ))}
      </div>
    </section>
  );
}

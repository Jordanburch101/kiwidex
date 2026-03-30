import { SectionHeader } from "@workspace/ui/components/section-header";
import { GroceryCharts } from "@/components/sections/grocery-charts";
import { getGroceryChartData } from "@/lib/queries";

export async function GroceryDeepDive() {
  const { milk, eggs, bread, butter, cheese, bananas } =
    await getGroceryChartData();

  const items = [
    { label: "Milk (2L)", data: milk },
    { label: "Eggs (Dozen)", data: eggs },
    { label: "Bread (Loaf)", data: bread },
    { label: "Butter (500g)", data: butter },
    { label: "Cheese (1kg)", data: cheese },
    { label: "Bananas (kg)", data: bananas },
  ];

  return (
    <section className="px-6 py-10">
      <SectionHeader
        subtitle="Daily averages across supermarkets"
        title="Grocery Prices"
      />
      <GroceryCharts items={items} />
    </section>
  );
}

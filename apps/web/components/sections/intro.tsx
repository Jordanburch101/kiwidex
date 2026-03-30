import { getIntroData } from "@/lib/queries";

export async function Intro() {
  const data = await getIntroData();

  return (
    <section aria-label="Economic summary" className="px-6">
      <div className="border-[#e5e0d5] border-b pb-6" style={{ clear: "both" }}>
        <span
          className="float-left mr-3 font-bold font-heading text-[#2a2520] text-[68px]"
          style={{ lineHeight: "0.9", height: "70.88px", overflow: "hidden" }}
        >
          A
        </span>
        <p className="text-[#444038] text-[13.5px] leading-[1.75]">
          {" cautious hold from the Reserve Bank at "}
          <span className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]">
            {data.cpi?.value ?? "—"}
          </span>
          {
            " CPI, flat grocery shelves, and a softening Kiwi dollar at "
          }
          <span className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]">
            {data.nzd_usd?.value ?? "—"}
          </span>
          {
            " paint a picture of an economy stuck in wait-and-see mode as we head into the second quarter. At the pump, Petrol 91 sits at "
          }
          <span className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]">
            {data.petrol_91?.value ?? "—"}
          </span>
          {
            ", well below last year's peak — a rare bright spot for household budgets. The labour market tells a more cautious story: unemployment has ticked up to "
          }
          <span className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]">
            {data.unemployment?.value ?? "—"}
          </span>
          {" while wage growth at "}
          <span className="rounded bg-[#f0ecdf] px-1.5 py-0.5 font-semibold text-[#2a2520]">
            {data.wage_growth?.value ?? "—"}
          </span>
          {
            " continues to lag behind inflation for the third straight quarter, leaving real incomes under pressure."
          }
        </p>
        <p className="mt-3 text-[#998] text-[9px] uppercase tracking-wider">
          Summary &middot;{" "}
          {new Date().toLocaleDateString("en-NZ", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
    </section>
  );
}

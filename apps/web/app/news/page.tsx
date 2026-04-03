import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsPageContent } from "@/components/sections/news-page-content";
import { getNewsPageData } from "@/lib/queries";

export const metadata: Metadata = {
  title: "In the News — The Kiwidex",
  description:
    "NZ economy reporting from RNZ, Stuff, Herald & 1News — grouped by story",
};

export default async function NewsPage() {
  const data = await getNewsPageData();

  if (!data) {
    return (
      <div className="px-6 py-20 text-center">
        <p className="text-[#998]">No stories available yet.</p>
      </div>
    );
  }

  return (
    <Suspense>
      <NewsPageContent stories={[data.lead, ...data.rest]} />
    </Suspense>
  );
}

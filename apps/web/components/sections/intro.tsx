import { getIntroData } from "@/lib/queries";
import { IntroLayout } from "./intro-layout";

export async function Intro() {
  const { summary, metrics } = await getIntroData();

  if (!summary) {
    return null;
  }

  return <IntroLayout summary={summary} metrics={metrics} />;
}

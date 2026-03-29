import type { MetricKey } from "@workspace/db/metrics";

export type CollectorResult = {
  metric: MetricKey;
  value: number;
  unit: string;
  date: string;
  source: string;
  metadata?: string;
};

export type Collector = () => Promise<CollectorResult[]>;

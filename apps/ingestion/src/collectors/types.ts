import type { MetricKey } from "@workspace/db/metrics";

export interface CollectorResult {
  date: string;
  metadata?: string;
  metric: MetricKey;
  source: string;
  unit: string;
  value: number;
}

export type Collector = () => Promise<CollectorResult[]>;

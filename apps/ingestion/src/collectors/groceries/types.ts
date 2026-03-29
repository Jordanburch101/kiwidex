import type { MetricKey } from "@workspace/db/metrics";

export interface GroceryProduct {
  expectedSize?: string;
  metric: MetricKey;
  query: string;
}

export interface ScrapedPrice {
  metric: MetricKey;
  price: number;
  productName: string;
  source: string;
}

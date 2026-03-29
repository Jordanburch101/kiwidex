export { db } from "./client";
export {
  METRIC_CATEGORIES,
  METRIC_KEYS,
  METRIC_META,
  type MetricCategory,
  type MetricKey,
  type MetricMeta,
} from "./metrics";
export {
  bulkInsert,
  getLatestByCategory,
  getLatestValue,
  getProductsByCategory,
  getTimeSeries,
  insertProducts,
  type NewProduct,
} from "./queries";
export { metrics, products } from "./schema";

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
  getLastSuccessDate,
  getLatestArticles,
  getLatestByCategory,
  getLatestRuns,
  getLatestValue,
  getProductsByCategory,
  getStaleCollectors,
  getTimeSeries,
  insertArticles,
  insertProducts,
  insertScraperRun,
  type NewArticle,
  type NewProduct,
  type NewScraperRun,
  type ScraperRun,
} from "./queries";
export { articles, metrics, products, scraperRuns } from "./schema";

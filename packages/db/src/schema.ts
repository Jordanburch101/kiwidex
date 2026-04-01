import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const metrics = sqliteTable(
  "metrics",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    metric: text("metric").notNull(),
    value: real("value").notNull(),
    unit: text("unit").notNull(),
    date: text("date").notNull(),
    source: text("source"),
    metadata: text("metadata"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex("metric_date_uniq").on(table.metric, table.date)]
);

export const scraperRuns = sqliteTable("scraper_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  collector: text("collector").notNull(),
  store: text("store"),
  status: text("status").notNull(),
  totalProducts: integer("total_products"),
  categories: text("categories"),
  error: text("error"),
  durationMs: integer("duration_ms"),
  date: text("date").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const products = sqliteTable(
  "products",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    productId: text("product_id").notNull(),
    store: text("store").notNull(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    size: text("size"),
    price: real("price").notNull(),
    unitPrice: text("unit_price"),
    date: text("date").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("product_store_date_uniq").on(
      table.productId,
      table.store,
      table.date
    ),
  ]
);

export const stocks = sqliteTable(
  "stocks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ticker: text("ticker").notNull(),
    date: text("date").notNull(),
    open: real("open").notNull(),
    high: real("high").notNull(),
    low: real("low").notNull(),
    close: real("close").notNull(),
    volume: integer("volume"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("stock_ticker_date_uniq").on(table.ticker, table.date),
  ]
);

export const summaries = sqliteTable("summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  metrics: text("metrics").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const articles = sqliteTable("articles", {
  url: text("url").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  imageUrl: text("image_url"),
  source: text("source").notNull(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

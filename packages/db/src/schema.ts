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

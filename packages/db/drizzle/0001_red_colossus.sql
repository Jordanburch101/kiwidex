CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` text NOT NULL,
	`store` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`size` text,
	`price` real NOT NULL,
	`unit_price` text,
	`date` text NOT NULL,
	`source` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_store_date_uniq` ON `products` (`product_id`,`store`,`date`);--> statement-breakpoint
DROP INDEX `metric_date_idx`;
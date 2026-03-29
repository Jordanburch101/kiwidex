CREATE TABLE `scraper_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`collector` text NOT NULL,
	`store` text,
	`status` text NOT NULL,
	`total_products` integer,
	`categories` text,
	`error` text,
	`duration_ms` integer,
	`date` text NOT NULL,
	`created_at` text NOT NULL
);

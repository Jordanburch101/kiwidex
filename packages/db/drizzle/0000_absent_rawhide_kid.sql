CREATE TABLE `metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`unit` text NOT NULL,
	`date` text NOT NULL,
	`source` text,
	`metadata` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `metric_date_uniq` ON `metrics` (`metric`,`date`);--> statement-breakpoint
CREATE INDEX `metric_date_idx` ON `metrics` (`metric`,`date`);
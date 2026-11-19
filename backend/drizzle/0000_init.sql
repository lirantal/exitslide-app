CREATE TABLE `ratings` (
	`session_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`session_id`, `submission_id`),
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rating_score" CHECK(typeof("ratings"."score") = 'integer' and "ratings"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE INDEX `ratings_by_session` ON `ratings` (`session_id`,`created_at`,`submission_id`);--> statement-breakpoint
CREATE TABLE `session_links` (
	`id` text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`slide_url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `session_links`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_by_owner` ON `sessions` (`owner_id`,`created_at`,`id`);
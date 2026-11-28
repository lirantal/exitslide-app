CREATE TABLE `engagement_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL,
	`country` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "engagement_event_type" CHECK("engagement_events"."type" in ('visit', 'slide_click'))
);
--> statement-breakpoint
CREATE INDEX `engagement_events_by_session` ON `engagement_events` (`session_id`,`created_at`);
CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`source` text NOT NULL,
	`distance` integer NOT NULL,
	`duration` integer NOT NULL,
	`points` integer NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_idempotency` ON `activities` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `point_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`kind` text NOT NULL,
	`reference` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_events_reference_unique` ON `point_events` (`reference`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`consent` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cost` integer NOT NULL,
	`token` text NOT NULL,
	`status` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `redemptions_token_unique` ON `redemptions` (`token`);--> statement-breakpoint
CREATE TABLE `saved_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`node_ids` text NOT NULL,
	`settings` text NOT NULL,
	`distance` integer NOT NULL,
	`shared` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`user_id` text PRIMARY KEY NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "wallet_nonnegative" CHECK("wallets"."points" >= 0 AND "wallets"."reserved" >= 0 AND "wallets"."reserved" <= "wallets"."points")
);

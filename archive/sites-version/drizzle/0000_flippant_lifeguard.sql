CREATE TABLE `challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`wallet` text NOT NULL,
	`message` text NOT NULL,
	`expires` integer NOT NULL,
	`used` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`recipe` text NOT NULL,
	`kind` text NOT NULL,
	`period` text NOT NULL,
	`day` text NOT NULL,
	`eligible` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_once` ON `events` (`user`,`recipe`,`kind`,`day`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`wallet` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`mime` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`ingredients` text NOT NULL,
	`steps` text NOT NULL,
	`minutes` integer NOT NULL,
	`servings` integer NOT NULL,
	`category` text NOT NULL,
	`image` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`hash` text NOT NULL,
	`sample` integer DEFAULT 0 NOT NULL,
	`created` text NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`recipe` text NOT NULL,
	`reason` text NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shelves` (
	`id` text PRIMARY KEY NOT NULL,
	`user` text NOT NULL,
	`recipe` text,
	`url` text DEFAULT '' NOT NULL,
	`title` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`ingredients` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shelf_recipe_user` ON `shelves` (`user`,`recipe`);--> statement-breakpoint
CREATE UNIQUE INDEX `shelf_url_user` ON `shelves` (`user`,`url`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`recipe` text NOT NULL,
	`url` text NOT NULL,
	`code` text NOT NULL,
	`status` text NOT NULL,
	`checked` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_url` ON `sources` (`url`);--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`payer_user` text NOT NULL,
	`payer` text NOT NULL,
	`recipient` text NOT NULL,
	`author` text NOT NULL,
	`period` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`signature` text,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transfer_signature` ON `transfers` (`signature`);--> statement-breakpoint
CREATE TABLE `versions` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe` text NOT NULL,
	`version` integer NOT NULL,
	`hash` text NOT NULL,
	`snapshot` text NOT NULL,
	`signature` text,
	`chain_status` text DEFAULT 'unrecorded' NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_version` ON `versions` (`recipe`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `anchor_signature` ON `versions` (`signature`);
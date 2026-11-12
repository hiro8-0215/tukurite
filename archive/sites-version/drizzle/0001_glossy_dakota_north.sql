ALTER TABLE `transfers` ADD `settlement_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `one_settlement` ON `transfers` (`settlement_key`);
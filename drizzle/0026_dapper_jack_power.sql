CREATE TABLE `devspace_settings` (
	`id` text PRIMARY KEY DEFAULT 'default' NOT NULL,
	`repos_path` text,
	`config_sub_path` text DEFAULT 'devspace.yaml' NOT NULL,
	`start_command` text DEFAULT 'devspace dev' NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `devspace_started_processes` (
	`id` text PRIMARY KEY NOT NULL,
	`pid` integer NOT NULL,
	`service_name` text NOT NULL,
	`service_path` text NOT NULL,
	`terminal_pane_id` text,
	`started_at` integer
);

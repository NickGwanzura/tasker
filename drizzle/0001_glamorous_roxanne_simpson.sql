CREATE TABLE "tasker"."settings" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"display_name" text DEFAULT 'Nicholas Gwanzura' NOT NULL,
	"plan_label" text DEFAULT 'Pro plan' NOT NULL,
	"theme" varchar(16) DEFAULT 'light' NOT NULL,
	"accent_color" varchar(16) DEFAULT '#3b5bdb' NOT NULL,
	"default_priority" varchar(16) DEFAULT 'Medium' NOT NULL,
	"default_column" varchar(32) DEFAULT 'todo' NOT NULL,
	"density" varchar(16) DEFAULT 'comfortable' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE SCHEMA "tasker";
--> statement-breakpoint
CREATE TABLE "tasker"."activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" varchar(64) NOT NULL,
	"icon" varchar(16) DEFAULT '📌' NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasker"."doc_pages" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"project_id" varchar(64) NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasker"."projects" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" varchar(16) DEFAULT '#3b5bdb' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasker"."prompts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"category" varchar(32) DEFAULT 'Other' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasker"."tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" varchar(64) NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" varchar(16) DEFAULT 'Medium' NOT NULL,
	"column" varchar(32) DEFAULT 'todo' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"due_date" text DEFAULT 'No date' NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"attachments" integer DEFAULT 0 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasker"."activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "tasker"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasker"."doc_pages" ADD CONSTRAINT "doc_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "tasker"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasker"."tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "tasker"."projects"("id") ON DELETE cascade ON UPDATE no action;
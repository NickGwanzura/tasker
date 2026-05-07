ALTER TABLE "tasker"."settings" ADD COLUMN "company_name" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."settings" ADD COLUMN "company_email" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."settings" ADD COLUMN "company_phone" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."settings" ADD COLUMN "company_address" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."settings" ADD COLUMN "company_tax_id" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."settings" ADD COLUMN "company_website" text DEFAULT '' NOT NULL;

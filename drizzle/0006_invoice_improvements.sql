ALTER TABLE "tasker"."invoices" ADD COLUMN "invoice_number" varchar(32) DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasker"."invoices" ADD COLUMN "discount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Backfill invoice_number for existing rows
UPDATE "tasker"."invoices"
SET "invoice_number" = 'INV-' || TO_CHAR("created_at", 'YYYY') || '-' || LPAD("id"::text, 4, '0')
WHERE "invoice_number" = '';

ALTER TABLE "tasker"."invoices" ADD COLUMN "paid_amount" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

-- Backfill paid_amount from existing receipts
UPDATE "tasker"."invoices" SET "paid_amount" = COALESCE(
  (SELECT SUM("amount") FROM "tasker"."receipts" WHERE "receipts"."invoice_id" = "invoices"."id"),
  0
);

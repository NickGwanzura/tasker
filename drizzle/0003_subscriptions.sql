CREATE TABLE "tasker"."subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor" text DEFAULT '' NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" varchar(8) DEFAULT 'USD' NOT NULL,
	"cycle_days" integer DEFAULT 30 NOT NULL,
	"last_paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasker"."subscription_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"paid_at" timestamp with time zone DEFAULT now() NOT NULL,
	"amount" integer NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasker"."subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "tasker"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;

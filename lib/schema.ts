import {
  pgSchema,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  serial,
  boolean,
} from "drizzle-orm/pg-core";

export const taskerSchema = pgSchema("tasker");

export const projects = taskerSchema.table("projects", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: varchar("color", { length: 16 }).notNull().default("#3b5bdb"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tasks = taskerSchema.table("tasks", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 64 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  priority: varchar("priority", { length: 16 }).notNull().default("Medium"),
  column: varchar("column", { length: 32 }).notNull().default("todo"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  dueDate: text("due_date").notNull().default("No date"),
  comments: integer("comments").notNull().default(0),
  attachments: integer("attachments").notNull().default(0),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const docPages = taskerSchema.table("doc_pages", {
  id: varchar("id", { length: 64 }).primaryKey(),
  projectId: varchar("project_id", { length: 64 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activities = taskerSchema.table("activities", {
  id: serial("id").primaryKey(),
  projectId: varchar("project_id", { length: 64 })
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  icon: varchar("icon", { length: 16 }).notNull().default("📌"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const prompts = taskerSchema.table("prompts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  category: varchar("category", { length: 32 }).notNull().default("Other"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = taskerSchema.table("settings", {
  id: varchar("id", { length: 16 }).primaryKey(),
  displayName: text("display_name").notNull().default("Nicholas Gwanzura"),
  planLabel: text("plan_label").notNull().default("Pro plan"),
  theme: varchar("theme", { length: 16 }).notNull().default("light"),
  accentColor: varchar("accent_color", { length: 16 }).notNull().default("#3b5bdb"),
  defaultPriority: varchar("default_priority", { length: 16 }).notNull().default("Medium"),
  defaultColumn: varchar("default_column", { length: 32 }).notNull().default("todo"),
  density: varchar("density", { length: 16 }).notNull().default("comfortable"),
  companyName: text("company_name").notNull().default(""),
  companyEmail: text("company_email").notNull().default(""),
  companyPhone: text("company_phone").notNull().default(""),
  companyAddress: text("company_address").notNull().default(""),
  companyTaxId: text("company_tax_id").notNull().default(""),
  companyWebsite: text("company_website").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotes = taskerSchema.table("quotes", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientAddress: text("client_address").notNull().default(""),
  items: jsonb("items").$type<Array<{ description: string; quantity: number; rate: number; amount: number }>>().notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("draft"), // draft, sent, accepted, rejected
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const invoices = taskerSchema.table("invoices", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientAddress: text("client_address").notNull().default(""),
  items: jsonb("items").$type<Array<{ description: string; quantity: number; rate: number; amount: number }>>().notNull().default([]),
  subtotal: integer("subtotal").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull().default(0),
  paidAmount: integer("paid_amount").notNull().default(0),
  status: varchar("status", { length: 16 }).notNull().default("unpaid"), // unpaid, partial, paid, overdue
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = taskerSchema.table("receipts", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  paymentMethod: varchar("payment_method", { length: 32 }).notNull(),
  transactionId: text("transaction_id").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type DocPage = typeof docPages.$inferSelect;
export type NewDocPage = typeof docPages.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;

export const subscriptions = taskerSchema.table("subscriptions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  vendor: text("vendor").notNull().default(""),
  amount: integer("amount").notNull().default(0),
  currency: varchar("currency", { length: 8 }).notNull().default("USD"),
  cycleDays: integer("cycle_days").notNull().default(30),
  lastPaidAt: timestamp("last_paid_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  active: boolean("active").notNull().default(true),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionPayments = taskerSchema.table("subscription_payments", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id")
    .notNull()
    .references(() => subscriptions.id, { onDelete: "cascade" }),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  amount: integer("amount").notNull(),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type SubscriptionPayment = typeof subscriptionPayments.$inferSelect;
export type NewSubscriptionPayment = typeof subscriptionPayments.$inferInsert;

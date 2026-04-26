import {
  pgSchema,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  serial,
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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
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

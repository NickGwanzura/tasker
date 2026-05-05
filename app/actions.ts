"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { projects, tasks, docPages, activities, prompts, settings, quotes, invoices, receipts } = schema;
const SETTINGS_ID = "default";

type ColKey = "todo" | "inprogress" | "inreview" | "done";

const COL_LABEL: Record<ColKey, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  inreview: "In Review",
  done: "Done",
};

// ---------- Projects ----------
export async function createProjectAction(input: {
  name: string;
  description: string;
  color: string;
}) {
  const id = "p" + Date.now();
  await db.insert(projects).values({
    id,
    name: input.name,
    description: input.description,
    color: input.color,
  });
  await db.insert(activities).values({
    projectId: id,
    icon: "🚀",
    text: "Project created",
  });
  revalidatePath("/");
  return { id };
}

// ---------- Tasks ----------
export async function addTaskAction(input: {
  projectId: string;
  title: string;
  description: string;
  priority: string;
  column: ColKey;
  tags: string[];
  dueDate: string;
}) {
  await db.insert(tasks).values({
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    column: input.column,
    tags: input.tags,
    dueDate: input.dueDate || "No date",
  });
  await db.insert(activities).values({
    projectId: input.projectId,
    icon: "✅",
    text: `Task <b>${escapeHtml(input.title)}</b> added to ${
      COL_LABEL[input.column]
    }`,
  });
  revalidatePath("/");
}

export async function updateTaskAction(input: {
  id: number;
  title?: string;
  description?: string;
  priority?: string;
  column?: ColKey;
  tags?: string[];
  dueDate?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.column !== undefined) patch.column = input.column;
  if (input.tags !== undefined) patch.tags = input.tags;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate || "No date";
  if (Object.keys(patch).length === 0) return;
  await db.update(tasks).set(patch).where(eq(tasks.id, input.id));
  revalidatePath("/");
}

export async function moveTaskAction(input: {
  id: number;
  toProjectId: string;
  toColumn: ColKey;
}) {
  const before = await db
    .select({ projectId: tasks.projectId, column: tasks.column, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.id, input.id))
    .limit(1);
  if (!before[0]) return;
  if (
    before[0].projectId === input.toProjectId &&
    before[0].column === input.toColumn
  ) {
    return;
  }
  await db
    .update(tasks)
    .set({ projectId: input.toProjectId, column: input.toColumn })
    .where(eq(tasks.id, input.id));
  await db.insert(activities).values({
    projectId: input.toProjectId,
    icon: "↔️",
    text: `Task <b>${escapeHtml(before[0].title)}</b> moved to ${
      COL_LABEL[input.toColumn]
    }`,
  });
  revalidatePath("/");
}

export async function deleteTaskAction(input: { id: number }) {
  const row = await db
    .select({ projectId: tasks.projectId, title: tasks.title })
    .from(tasks)
    .where(eq(tasks.id, input.id))
    .limit(1);
  await db.delete(tasks).where(eq(tasks.id, input.id));
  if (row[0]) {
    await db.insert(activities).values({
      projectId: row[0].projectId,
      icon: "🗑️",
      text: `Task <b>${escapeHtml(row[0].title)}</b> deleted`,
    });
  }
  revalidatePath("/");
}

// ---------- Doc pages ----------
export async function newDocAction(input: { projectId: string }) {
  const id = "d" + Date.now();
  await db.insert(docPages).values({
    id,
    projectId: input.projectId,
    title: "",
    content: "",
  });
  await db.insert(activities).values({
    projectId: input.projectId,
    icon: "📄",
    text: "New doc page created",
  });
  revalidatePath("/");
  return { id };
}

export async function updateDocAction(input: {
  id: string;
  title?: string;
  content?: string;
}) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  await db.update(docPages).set(patch).where(eq(docPages.id, input.id));
  revalidatePath("/");
}

export async function deleteDocAction(input: { id: string }) {
  await db.delete(docPages).where(eq(docPages.id, input.id));
  revalidatePath("/");
}

// ---------- Prompts ----------
export async function addPromptAction(input: {
  title: string;
  text: string;
  category: string;
}) {
  await db.insert(prompts).values({
    title: input.title,
    text: input.text,
    category: input.category,
  });
  revalidatePath("/");
}

// ---------- Quotes ----------
export async function createQuoteAction(input: {
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  notes: string;
}) {
  await db.insert(quotes).values({
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientAddress: input.clientAddress,
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    notes: input.notes,
  });
  revalidatePath("/");
}

export async function updateQuoteAction(input: {
  id: number;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  items?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: string;
  notes?: string;
}) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientEmail !== undefined) patch.clientEmail = input.clientEmail;
  if (input.clientAddress !== undefined) patch.clientAddress = input.clientAddress;
  if (input.items !== undefined) patch.items = input.items;
  if (input.subtotal !== undefined) patch.subtotal = input.subtotal;
  if (input.tax !== undefined) patch.tax = input.tax;
  if (input.total !== undefined) patch.total = input.total;
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes;
  await db.update(quotes).set(patch).where(eq(quotes.id, input.id));
  revalidatePath("/");
}

export async function deleteQuoteAction(input: { id: number }) {
  await db.delete(quotes).where(eq(quotes.id, input.id));
  revalidatePath("/");
}

// ---------- Invoices ----------
export async function createInvoiceAction(input: {
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal: number;
  tax: number;
  total: number;
  dueDate: Date;
  notes: string;
}) {
  await db.insert(invoices).values({
    clientName: input.clientName,
    clientEmail: input.clientEmail,
    clientAddress: input.clientAddress,
    items: input.items,
    subtotal: input.subtotal,
    tax: input.tax,
    total: input.total,
    dueDate: input.dueDate,
    notes: input.notes,
  });
  revalidatePath("/");
}

export async function updateInvoiceAction(input: {
  id: number;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  items?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  status?: string;
  dueDate?: Date;
  notes?: string;
}) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.clientName !== undefined) patch.clientName = input.clientName;
  if (input.clientEmail !== undefined) patch.clientEmail = input.clientEmail;
  if (input.clientAddress !== undefined) patch.clientAddress = input.clientAddress;
  if (input.items !== undefined) patch.items = input.items;
  if (input.subtotal !== undefined) patch.subtotal = input.subtotal;
  if (input.tax !== undefined) patch.tax = input.tax;
  if (input.total !== undefined) patch.total = input.total;
  if (input.status !== undefined) patch.status = input.status;
  if (input.dueDate !== undefined) patch.dueDate = input.dueDate;
  if (input.notes !== undefined) patch.notes = input.notes;
  await db.update(invoices).set(patch).where(eq(invoices.id, input.id));
  revalidatePath("/");
}

export async function deleteInvoiceAction(input: { id: number }) {
  await db.delete(invoices).where(eq(invoices.id, input.id));
  revalidatePath("/");
}

// ---------- Receipts ----------
export async function createReceiptAction(input: {
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  notes: string;
}) {
  await db.insert(receipts).values({
    invoiceId: input.invoiceId,
    amount: input.amount,
    paymentMethod: input.paymentMethod,
    transactionId: input.transactionId,
    notes: input.notes,
  });
  revalidatePath("/");
}

export async function updateReceiptAction(input: {
  id: number;
  invoiceId?: number;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (input.invoiceId !== undefined) patch.invoiceId = input.invoiceId;
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.paymentMethod !== undefined) patch.paymentMethod = input.paymentMethod;
  if (input.transactionId !== undefined) patch.transactionId = input.transactionId;
  if (input.notes !== undefined) patch.notes = input.notes;
  await db.update(receipts).set(patch).where(eq(receipts.id, input.id));
  revalidatePath("/");
}

export async function deleteReceiptAction(input: { id: number }) {
  await db.delete(receipts).where(eq(receipts.id, input.id));
  revalidatePath("/");
}

// ---------- Loaders ----------
async function safeSelect<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    // Most common cause: the table has not been migrated in this environment yet.
    // Don't crash the whole page — log and return empty.
    console.error(`[loadAllData] ${label} query failed:`, err);
    return [];
  }
}

export async function loadAllData() {
  const [allProjects, allTasks, allDocs, allActivities, allPrompts, settingsRow, allQuotes, allInvoices, allReceipts] =
    await Promise.all([
      safeSelect("projects", () => db.select().from(projects).orderBy(asc(projects.createdAt))),
      safeSelect("tasks", () => db.select().from(tasks).orderBy(asc(tasks.position), asc(tasks.id))),
      safeSelect("docPages", () => db.select().from(docPages).orderBy(asc(docPages.createdAt))),
      safeSelect("activities", () => db.select().from(activities).orderBy(desc(activities.createdAt))),
      safeSelect("prompts", () => db.select().from(prompts).orderBy(desc(prompts.createdAt))),
      safeSelect("settings", () =>
        db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1)
      ),
      safeSelect("quotes", () => db.select().from(quotes).orderBy(desc(quotes.createdAt))),
      safeSelect("invoices", () => db.select().from(invoices).orderBy(desc(invoices.createdAt))),
      safeSelect("receipts", () => db.select().from(receipts).orderBy(desc(receipts.createdAt))),
    ]);
  let appSettings = settingsRow[0];
  if (!appSettings) {
    try {
      const inserted = await db
        .insert(settings)
        .values({ id: SETTINGS_ID })
        .returning();
      appSettings = inserted[0];
    } catch (err) {
      console.error("[loadAllData] settings seed failed:", err);
    }
  }
  if (!appSettings) {
    appSettings = {
      id: SETTINGS_ID,
      displayName: "Nicholas Gwanzura",
      planLabel: "Pro plan",
      theme: "light",
      accentColor: "#3b5bdb",
      defaultPriority: "Medium",
      defaultColumn: "todo",
      density: "comfortable",
      updatedAt: new Date(),
    } as typeof settings.$inferSelect;
  }
  return {
    allProjects,
    allTasks,
    allDocs,
    allActivities,
    allPrompts,
    appSettings,
    allQuotes,
    allInvoices,
    allReceipts,
  };
}

// ---------- Settings ----------
export async function updateSettingsAction(input: {
  displayName?: string;
  planLabel?: string;
  theme?: string;
  accentColor?: string;
  defaultPriority?: string;
  defaultColumn?: string;
  density?: string;
}) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.displayName !== undefined) patch.displayName = input.displayName;
  if (input.planLabel !== undefined) patch.planLabel = input.planLabel;
  if (input.theme !== undefined) patch.theme = input.theme;
  if (input.accentColor !== undefined) patch.accentColor = input.accentColor;
  if (input.defaultPriority !== undefined)
    patch.defaultPriority = input.defaultPriority;
  if (input.defaultColumn !== undefined) patch.defaultColumn = input.defaultColumn;
  if (input.density !== undefined) patch.density = input.density;
  await db.update(settings).set(patch).where(eq(settings.id, SETTINGS_ID));
  revalidatePath("/");
}

// ---------- Data ops ----------
export async function exportAllDataAction() {
  const [allProjects, allTasks, allDocs, allActivities, allPrompts, settingsRow, allQuotes, allInvoices, allReceipts] =
    await Promise.all([
      db.select().from(projects),
      db.select().from(tasks),
      db.select().from(docPages),
      db.select().from(activities),
      db.select().from(prompts),
      db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1),
      db.select().from(quotes),
      db.select().from(invoices),
      db.select().from(receipts),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    projects: allProjects,
    tasks: allTasks,
    docPages: allDocs,
    activities: allActivities,
    prompts: allPrompts,
    settings: settingsRow[0] ?? null,
    quotes: allQuotes,
    invoices: allInvoices,
    receipts: allReceipts,
  };
}

export async function wipeAllDataAction() {
  // Cascade FKs handle children, but be explicit for safety + activities/prompts cleanup
  await db.delete(receipts);
  await db.delete(invoices);
  await db.delete(quotes);
  await db.delete(activities);
  await db.delete(tasks);
  await db.delete(docPages);
  await db.delete(projects);
  await db.delete(prompts);
  revalidatePath("/");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

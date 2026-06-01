"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const {
  projects,
  tasks,
  docPages,
  activities,
  prompts,
  settings,
  quotes,
  invoices,
  receipts,
  subscriptions,
  subscriptionPayments,
} = schema;
const SETTINGS_ID = "default";

type ColKey = "todo" | "inprogress" | "inreview" | "done";

const COL_LABEL: Record<ColKey, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  inreview: "In Review",
  done: "Done",
};

function assertString(v: unknown, field: string, { min = 0, max = 10000 } = {}): string {
  if (typeof v !== "string") throw new Error(`${field} must be a string`);
  if (v.length < min) throw new Error(`${field} is required`);
  if (v.length > max) throw new Error(`${field} is too long`);
  return v;
}
function assertInt(v: unknown, field: string, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}): number {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
    throw new Error(`${field} must be an integer`);
  }
  if (v < min || v > max) throw new Error(`${field} out of range`);
  return v;
}
function assertItems(v: unknown): Array<{ description: string; quantity: number; rate: number; amount: number; discount?: number }> {
  if (!Array.isArray(v)) throw new Error("items must be an array");
  return v.map((it, i) => {
    if (!it || typeof it !== "object") throw new Error(`items[${i}] invalid`);
    const o = it as Record<string, unknown>;
    const item: { description: string; quantity: number; rate: number; amount: number; discount?: number } = {
      description: assertString(o.description, `items[${i}].description`, { max: 1000 }),
      quantity: assertInt(o.quantity, `items[${i}].quantity`, { min: 0, max: 1_000_000 }),
      rate: assertInt(o.rate, `items[${i}].rate`, { min: 0, max: 1_000_000_000 }),
      amount: assertInt(o.amount, `items[${i}].amount`, { min: 0, max: 1_000_000_000 }),
    };
    if (o.discount !== undefined && o.discount !== null) {
      item.discount = assertInt(o.discount, `items[${i}].discount`, { min: 0, max: 100 });
    }
    return item;
  });
}

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
  try {
    const clientName = assertString(input.clientName, "clientName", { min: 1, max: 200 });
    const clientEmail = assertString(input.clientEmail, "clientEmail", { min: 1, max: 200 });
    const clientAddress = assertString(input.clientAddress, "clientAddress", { max: 1000 });
    const notes = assertString(input.notes, "notes", { max: 5000 });
    const items = assertItems(input.items);
    const subtotal = assertInt(input.subtotal, "subtotal", { min: 0 });
    const tax = assertInt(input.tax, "tax", { min: 0 });
    const total = assertInt(input.total, "total", { min: 0 });
    const inserted = await db
      .insert(quotes)
      .values({
        clientName,
        clientEmail,
        clientAddress,
        items,
        subtotal,
        tax,
        total,
        notes,
      })
      .returning();
    revalidatePath("/");
    return { id: inserted[0]?.id, status: inserted[0]?.status ?? "draft" };
  } catch (err) {
    console.error("[createQuoteAction]", err);
    throw new Error("createQuoteAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
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
  try {
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
  } catch (err) {
    console.error("[updateQuoteAction]", err);
    throw new Error("updateQuoteAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function deleteQuoteAction(input: { id: number }) {
  try {
    await db.delete(quotes).where(eq(quotes.id, input.id));
    revalidatePath("/");
  } catch (err) {
    console.error("[deleteQuoteAction]", err);
    throw new Error("deleteQuoteAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

// ---------- Invoices ----------
export async function createInvoiceAction(input: {
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: Array<{ description: string; quantity: number; rate: number; amount: number; discount?: number }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  dueDate: string;
  notes: string;
}) {
  try {
    const clientName = assertString(input.clientName, "clientName", { min: 1, max: 200 });
    const clientEmail = assertString(input.clientEmail, "clientEmail", { min: 1, max: 200 });
    const clientAddress = assertString(input.clientAddress, "clientAddress", { max: 1000 });
    const notes = assertString(input.notes, "notes", { max: 5000 });
    const items = assertItems(input.items);
    const subtotal = assertInt(input.subtotal, "subtotal", { min: 0 });
    const discount = assertInt(input.discount ?? 0, "discount", { min: 0 });
    const tax = assertInt(input.tax, "tax", { min: 0 });
    const total = assertInt(input.total, "total", { min: 0 });
    const dueDateStr = assertString(input.dueDate, "dueDate", { min: 1, max: 64 });
    const dueDate = new Date(dueDateStr);
    if (isNaN(dueDate.getTime())) throw new Error("Invalid dueDate");
    const inserted = await db
      .insert(invoices)
      .values({
        clientName,
        clientEmail,
        clientAddress,
        items,
        subtotal,
        discount,
        tax,
        total,
        dueDate,
        notes,
      })
      .returning();
    const id = inserted[0]?.id;
    const year = new Date().getFullYear();
    const invoiceNumber = `INV-${year}-${String(id).padStart(4, "0")}`;
    await db.update(invoices).set({ invoiceNumber }).where(eq(invoices.id, id));
    revalidatePath("/");
    return { id, status: inserted[0]?.status ?? "unpaid", invoiceNumber };
  } catch (err) {
    console.error("[createInvoiceAction]", err);
    throw new Error("createInvoiceAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function updateInvoiceAction(input: {
  id: number;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  items?: Array<{ description: string; quantity: number; rate: number; amount: number; discount?: number }>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paidAmount?: number;
  status?: string;
  dueDate?: string;
  notes?: string;
}) {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.clientName !== undefined) patch.clientName = input.clientName;
    if (input.clientEmail !== undefined) patch.clientEmail = input.clientEmail;
    if (input.clientAddress !== undefined) patch.clientAddress = input.clientAddress;
    if (input.items !== undefined) patch.items = input.items;
    if (input.subtotal !== undefined) patch.subtotal = input.subtotal;
    if (input.discount !== undefined) patch.discount = input.discount;
    if (input.tax !== undefined) patch.tax = input.tax;
    if (input.total !== undefined) patch.total = input.total;
    if (input.paidAmount !== undefined) patch.paidAmount = input.paidAmount;
    if (input.status !== undefined) patch.status = input.status;
    if (input.dueDate !== undefined) {
      const d = new Date(input.dueDate);
      if (isNaN(d.getTime())) throw new Error("Invalid dueDate");
      patch.dueDate = d;
    }
    if (input.notes !== undefined) patch.notes = input.notes;
    await db.update(invoices).set(patch).where(eq(invoices.id, input.id));
    revalidatePath("/");
  } catch (err) {
    console.error("[updateInvoiceAction]", err);
    throw new Error("updateInvoiceAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function deleteInvoiceAction(input: { id: number }) {
  try {
    await db.delete(invoices).where(eq(invoices.id, input.id));
    revalidatePath("/");
  } catch (err) {
    console.error("[deleteInvoiceAction]", err);
    throw new Error("deleteInvoiceAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

// ---------- Receipts ----------
async function recalcInvoicePaidAmount(invoiceId: number) {
  const rows = await db
    .select({ paid: receipts.amount })
    .from(receipts)
    .where(eq(receipts.invoiceId, invoiceId));
  const paidAmount = rows.reduce((s, r) => s + r.paid, 0);
  const inv = await db
    .select({ total: invoices.total, status: invoices.status, dueDate: invoices.dueDate })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!inv[0]) return;
  const isPastDue = inv[0].dueDate && inv[0].dueDate < new Date();
  let status: string;
  if (paidAmount >= inv[0].total) {
    status = "paid";
  } else if (paidAmount > 0) {
    status = "partial";
  } else {
    status = isPastDue ? "overdue" : "unpaid";
  }
  await db
    .update(invoices)
    .set({ paidAmount, status, updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));
}

export async function createReceiptAction(input: {
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  notes: string;
}) {
  try {
    const invoiceId = assertInt(input.invoiceId, "invoiceId", { min: 1 });
    const amount = assertInt(input.amount, "amount", { min: 1 });
    const paymentMethod = assertString(input.paymentMethod, "paymentMethod", { min: 1, max: 64 });
    const transactionId = assertString(input.transactionId, "transactionId", { max: 200 });
    const notes = assertString(input.notes, "notes", { max: 5000 });
    const exists = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
    if (!exists[0]) throw new Error("Invoice not found");
    const inserted = await db
      .insert(receipts)
      .values({
        invoiceId,
        amount,
        paymentMethod,
        transactionId,
        notes,
      })
      .returning();
    await recalcInvoicePaidAmount(invoiceId);
    revalidatePath("/");
    return { id: inserted[0]?.id };
  } catch (err) {
    console.error("[createReceiptAction]", err);
    throw new Error("createReceiptAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function updateReceiptAction(input: {
  id: number;
  invoiceId?: number;
  amount?: number;
  paymentMethod?: string;
  transactionId?: string;
  notes?: string;
}) {
  try {
    const patch: Record<string, unknown> = {};
    if (input.invoiceId !== undefined) patch.invoiceId = input.invoiceId;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.paymentMethod !== undefined) patch.paymentMethod = input.paymentMethod;
    if (input.transactionId !== undefined) patch.transactionId = input.transactionId;
    if (input.notes !== undefined) patch.notes = input.notes;
    // Get the receipt's invoice ID before update (or use provided one)
    const before = await db
      .select({ invoiceId: receipts.invoiceId })
      .from(receipts)
      .where(eq(receipts.id, input.id))
      .limit(1);
    await db.update(receipts).set(patch).where(eq(receipts.id, input.id));
    const affectedInvoiceId = input.invoiceId ?? before[0]?.invoiceId;
    if (affectedInvoiceId) {
      await recalcInvoicePaidAmount(affectedInvoiceId);
    }
    revalidatePath("/");
  } catch (err) {
    console.error("[updateReceiptAction]", err);
    throw new Error("updateReceiptAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function deleteReceiptAction(input: { id: number }) {
  try {
    const before = await db
      .select({ invoiceId: receipts.invoiceId })
      .from(receipts)
      .where(eq(receipts.id, input.id))
      .limit(1);
    await db.delete(receipts).where(eq(receipts.id, input.id));
    if (before[0]) {
      await recalcInvoicePaidAmount(before[0].invoiceId);
    }
    revalidatePath("/");
  } catch (err) {
    console.error("[deleteReceiptAction]", err);
    throw new Error("deleteReceiptAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
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
  const [
    allProjects,
    allTasks,
    allDocs,
    allActivities,
    allPrompts,
    settingsRow,
    allQuotes,
    allInvoices,
    allReceipts,
    allSubscriptions,
    allSubscriptionPayments,
  ] = await Promise.all([
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
    safeSelect("subscriptions", () =>
      db.select().from(subscriptions).orderBy(asc(subscriptions.expiresAt))
    ),
    safeSelect("subscriptionPayments", () =>
      db.select().from(subscriptionPayments).orderBy(desc(subscriptionPayments.paidAt))
    ),
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
      companyName: "",
      companyEmail: "",
      companyPhone: "",
      companyAddress: "",
      companyTaxId: "",
      companyWebsite: "",
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
    allSubscriptions,
    allSubscriptionPayments,
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
  companyName?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyAddress?: string;
  companyTaxId?: string;
  companyWebsite?: string;
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
  if (input.companyName !== undefined) patch.companyName = input.companyName;
  if (input.companyEmail !== undefined) patch.companyEmail = input.companyEmail;
  if (input.companyPhone !== undefined) patch.companyPhone = input.companyPhone;
  if (input.companyAddress !== undefined) patch.companyAddress = input.companyAddress;
  if (input.companyTaxId !== undefined) patch.companyTaxId = input.companyTaxId;
  if (input.companyWebsite !== undefined) patch.companyWebsite = input.companyWebsite;
  await db.update(settings).set(patch).where(eq(settings.id, SETTINGS_ID));
  revalidatePath("/");
}

// ---------- Data ops ----------
export async function exportAllDataAction() {
  const [
    allProjects,
    allTasks,
    allDocs,
    allActivities,
    allPrompts,
    settingsRow,
    allQuotes,
    allInvoices,
    allReceipts,
    allSubscriptions,
    allSubscriptionPayments,
  ] = await Promise.all([
    db.select().from(projects),
    db.select().from(tasks),
    db.select().from(docPages),
    db.select().from(activities),
    db.select().from(prompts),
    db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1),
    db.select().from(quotes),
    db.select().from(invoices),
    db.select().from(receipts),
    db.select().from(subscriptions),
    db.select().from(subscriptionPayments),
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
    subscriptions: allSubscriptions,
    subscriptionPayments: allSubscriptionPayments,
  };
}

export async function wipeAllDataAction() {
  // Cascade FKs handle children, but be explicit for safety + activities/prompts cleanup
  await db.delete(subscriptionPayments);
  await db.delete(subscriptions);
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

// ---------- Subscriptions ----------
function addDays(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export async function createSubscriptionAction(input: {
  name: string;
  vendor: string;
  amount: number;
  currency: string;
  cycleDays: number;
  lastPaidAt: string;
  notes: string;
}) {
  try {
    const name = assertString(input.name, "name", { min: 1, max: 200 });
    const vendor = assertString(input.vendor, "vendor", { max: 200 });
    const amount = assertInt(input.amount, "amount", { min: 0, max: 1_000_000_000 });
    const currency = assertString(input.currency, "currency", { min: 1, max: 8 });
    const cycleDays = assertInt(input.cycleDays, "cycleDays", { min: 1, max: 366 });
    const notes = assertString(input.notes, "notes", { max: 5000 });
    const paidAt = new Date(input.lastPaidAt);
    if (isNaN(paidAt.getTime())) throw new Error("Invalid lastPaidAt");
    const expiresAt = addDays(paidAt, cycleDays);
    const inserted = await db
      .insert(subscriptions)
      .values({
        name,
        vendor,
        amount,
        currency,
        cycleDays,
        lastPaidAt: paidAt,
        expiresAt,
        notes,
      })
      .returning();
    const sub = inserted[0];
    if (sub) {
      await db.insert(subscriptionPayments).values({
        subscriptionId: sub.id,
        paidAt,
        amount,
        notes: "Initial billing on file",
      });
    }
    revalidatePath("/");
    return { id: sub?.id, expiresAt: sub?.expiresAt?.toISOString() };
  } catch (err) {
    console.error("[createSubscriptionAction]", err);
    throw new Error("createSubscriptionAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function recordSubscriptionPaymentAction(input: {
  subscriptionId: number;
  paidAt: string;
  amount?: number;
  notes?: string;
}) {
  try {
    const subscriptionId = assertInt(input.subscriptionId, "subscriptionId", { min: 1 });
    const paidAt = new Date(input.paidAt);
    if (isNaN(paidAt.getTime())) throw new Error("Invalid paidAt");
    const subRow = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    const sub = subRow[0];
    if (!sub) throw new Error("Subscription not found");
    const amount =
      input.amount !== undefined
        ? assertInt(input.amount, "amount", { min: 0, max: 1_000_000_000 })
        : sub.amount;
    const notes = assertString(input.notes ?? "", "notes", { max: 5000 });
    const expiresAt = addDays(paidAt, sub.cycleDays);
    await db.insert(subscriptionPayments).values({
      subscriptionId,
      paidAt,
      amount,
      notes,
    });
    await db
      .update(subscriptions)
      .set({ lastPaidAt: paidAt, expiresAt, updatedAt: new Date() })
      .where(eq(subscriptions.id, subscriptionId));
    revalidatePath("/");
    return { expiresAt: expiresAt.toISOString() };
  } catch (err) {
    console.error("[recordSubscriptionPaymentAction]", err);
    throw new Error("recordSubscriptionPaymentAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function updateSubscriptionAction(input: {
  id: number;
  name?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  cycleDays?: number;
  active?: boolean;
  notes?: string;
}) {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.vendor !== undefined) patch.vendor = input.vendor;
    if (input.amount !== undefined) patch.amount = input.amount;
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.cycleDays !== undefined) {
      patch.cycleDays = input.cycleDays;
      const subRow = await db
        .select({ lastPaidAt: subscriptions.lastPaidAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, input.id))
        .limit(1);
      if (subRow[0]) {
        patch.expiresAt = addDays(new Date(subRow[0].lastPaidAt), input.cycleDays);
      }
    }
    if (input.active !== undefined) patch.active = input.active;
    if (input.notes !== undefined) patch.notes = input.notes;
    await db.update(subscriptions).set(patch).where(eq(subscriptions.id, input.id));
    revalidatePath("/");
  } catch (err) {
    console.error("[updateSubscriptionAction]", err);
    throw new Error("updateSubscriptionAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export async function deleteSubscriptionAction(input: { id: number }) {
  try {
    await db.delete(subscriptions).where(eq(subscriptions.id, input.id));
    revalidatePath("/");
  } catch (err) {
    console.error("[deleteSubscriptionAction]", err);
    throw new Error("deleteSubscriptionAction failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

// ---------- AI News ----------
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  points: number;
  comments: number;
  author: string;
  publishedAt: string;
};

type HNHit = {
  objectID: string;
  title?: string | null;
  story_title?: string | null;
  url?: string | null;
  story_url?: string | null;
  points?: number | null;
  num_comments?: number | null;
  author?: string | null;
  created_at?: string | null;
};

async function searchHN(query: string, hitsPerPage = 12): Promise<HNHit[]> {
  // HN Algolia returns 0 hits when given an "OR" expression — we have to
  // run separate keyword queries and merge.
  const url =
    "https://hn.algolia.com/api/v1/search_by_date?query=" +
    encodeURIComponent(query) +
    "&tags=story&hitsPerPage=" +
    hitsPerPage;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error("HN search returned " + res.status);
  const data = (await res.json()) as { hits?: HNHit[] };
  return Array.isArray(data.hits) ? data.hits : [];
}

export async function fetchAINewsAction(): Promise<{
  items: NewsItem[];
  fetchedAt: string;
  error: string | null;
}> {
  const fetchedAt = new Date().toISOString();
  try {
    const queries = ["Claude", "GPT", "Gemini", "Llama", "LLM benchmark", "model release"];
    const results = await Promise.all(queries.map((q) => searchHN(q, 12)));
    const merged = new Map<string, HNHit>();
    for (const list of results) {
      for (const h of list) {
        if (!merged.has(h.objectID)) merged.set(h.objectID, h);
      }
    }
    const items: NewsItem[] = Array.from(merged.values())
      .map((h) => {
        const title = h.title ?? h.story_title ?? "";
        const link =
          h.url ??
          h.story_url ??
          (h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : "");
        if (!title || !link) return null;
        let source = "Hacker News";
        try {
          source = new URL(link).hostname.replace(/^www\./, "");
        } catch {
          // ignore
        }
        return {
          id: h.objectID,
          title,
          url: link,
          source,
          points: typeof h.points === "number" ? h.points : 0,
          comments: typeof h.num_comments === "number" ? h.num_comments : 0,
          author: h.author ?? "",
          publishedAt: h.created_at ?? "",
        } as NewsItem;
      })
      .filter((x): x is NewsItem => x !== null)
      .sort((a, b) => {
        const ta = new Date(a.publishedAt).getTime() || 0;
        const tb = new Date(b.publishedAt).getTime() || 0;
        return tb - ta;
      })
      .slice(0, 30);
    return { items, fetchedAt, error: null };
  } catch (err) {
    console.error("[fetchAINewsAction]", err);
    return {
      items: [],
      fetchedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

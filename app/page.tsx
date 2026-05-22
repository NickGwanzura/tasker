import TaskManager from "./TaskManager";
import { loadAllData } from "./actions";

export const dynamic = "force-dynamic";

type ColKey = "todo" | "inprogress" | "inreview" | "done";

const EMPTY_DATA = {
  allProjects: [],
  allTasks: [],
  allDocs: [],
  allActivities: [],
  allPrompts: [],
  appSettings: null as Awaited<ReturnType<typeof loadAllData>>["appSettings"] | null,
  allQuotes: [],
  allInvoices: [],
  allReceipts: [],
  allSubscriptions: [],
  allSubscriptionPayments: [],
} as Awaited<ReturnType<typeof loadAllData>>;

export default async function Page() {
  let data: Awaited<ReturnType<typeof loadAllData>>;
  try {
    data = await loadAllData();
  } catch (err) {
    console.error("[page.tsx] loadAllData rejected:", err);
    data = EMPTY_DATA;
  }
  const {
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
  } = data;

  // Group children by project for the client component
  const initialProjects = safeMap(allProjects, "projects", (p) => {
    const projTasks = allTasks.filter((t) => t.projectId === p.id);
    const grouped: Record<ColKey, typeof projTasks> = {
      todo: [],
      inprogress: [],
      inreview: [],
      done: [],
    };
    for (const t of projTasks) {
      const col = (t.column as ColKey) ?? "todo";
      if (grouped[col]) grouped[col].push(t);
    }
    return {
      id: p.id,
      name: p.name ?? "",
      desc: p.description ?? "",
      color: p.color ?? "#3b5bdb",
      tasks: {
        todo: grouped.todo.map(toClientTask),
        inprogress: grouped.inprogress.map(toClientTask),
        inreview: grouped.inreview.map(toClientTask),
        done: grouped.done.map(toClientTask),
      },
      docs: safeMap(
        allDocs.filter((d) => d.projectId === p.id),
        "docs",
        (d) => ({
          id: d.id,
          title: d.title ?? "",
          content: d.content ?? "",
          updated: relTime(d.updatedAt),
        })
      ),
      activity: safeMap(
        allActivities.filter((a) => a.projectId === p.id),
        "activities",
        (a) => ({
          icon: a.icon ?? "📌",
          text: a.text ?? "",
          time: relTime(a.createdAt),
        })
      ),
    };
  });

  const initialPrompts = safeMap(allPrompts, "prompts", (p) => ({
    title: p.title ?? "",
    text: p.text ?? "",
    category: p.category ?? "Other",
    date: shortDate(p.createdAt),
  }));

  const initialSettings = {
    displayName: appSettings?.displayName ?? "Nicholas Gwanzura",
    planLabel: appSettings?.planLabel ?? "Pro plan",
    theme: appSettings?.theme ?? "light",
    accentColor: appSettings?.accentColor ?? "#3b5bdb",
    defaultPriority: appSettings?.defaultPriority ?? "Medium",
    defaultColumn: appSettings?.defaultColumn ?? "todo",
    density: appSettings?.density ?? "comfortable",
    companyName: appSettings?.companyName ?? "",
    companyEmail: appSettings?.companyEmail ?? "",
    companyPhone: appSettings?.companyPhone ?? "",
    companyAddress: appSettings?.companyAddress ?? "",
    companyTaxId: appSettings?.companyTaxId ?? "",
    companyWebsite: appSettings?.companyWebsite ?? "",
  };

  const initialQuotes = safeMap(allQuotes, "quotes", (q) => ({
    id: q.id,
    clientName: q.clientName ?? "",
    clientEmail: q.clientEmail ?? "",
    clientAddress: q.clientAddress ?? "",
    items: Array.isArray(q.items) ? q.items : [],
    subtotal: q.subtotal ?? 0,
    tax: q.tax ?? 0,
    total: q.total ?? 0,
    status: q.status ?? "draft",
    notes: q.notes ?? "",
    createdAt: relTime(q.createdAt),
    updatedAt: relTime(q.updatedAt),
  }));

  const initialInvoices = safeMap(allInvoices, "invoices", (i) => ({
    id: i.id,
    clientName: i.clientName ?? "",
    clientEmail: i.clientEmail ?? "",
    clientAddress: i.clientAddress ?? "",
    items: Array.isArray(i.items) ? i.items : [],
    subtotal: i.subtotal ?? 0,
    tax: i.tax ?? 0,
    total: i.total ?? 0,
    paidAmount: i.paidAmount ?? 0,
    status: i.status ?? "unpaid",
    dueDate: isoOrEmpty(i.dueDate),
    notes: i.notes ?? "",
    createdAt: relTime(i.createdAt),
    updatedAt: relTime(i.updatedAt),
  }));

  const initialReceipts = safeMap(allReceipts, "receipts", (r) => ({
    id: r.id,
    invoiceId: r.invoiceId,
    amount: r.amount ?? 0,
    paymentMethod: r.paymentMethod ?? "",
    transactionId: r.transactionId ?? "",
    notes: r.notes ?? "",
    createdAt: relTime(r.createdAt),
  }));

  const initialSubscriptions = safeMap(allSubscriptions, "subscriptions", (s) => ({
    id: s.id,
    name: s.name ?? "",
    vendor: s.vendor ?? "",
    amount: s.amount ?? 0,
    currency: s.currency ?? "USD",
    cycleDays: s.cycleDays ?? 30,
    lastPaidAt: isoOrEmpty(s.lastPaidAt),
    expiresAt: isoOrEmpty(s.expiresAt),
    active: s.active ?? true,
    notes: s.notes ?? "",
    createdAt: isoOrEmpty(s.createdAt),
    updatedAt: isoOrEmpty(s.updatedAt),
  }));

  const initialSubscriptionPayments = safeMap(
    allSubscriptionPayments,
    "subscriptionPayments",
    (p) => ({
      id: p.id,
      subscriptionId: p.subscriptionId,
      paidAt: isoOrEmpty(p.paidAt),
      amount: p.amount ?? 0,
      notes: p.notes ?? "",
      createdAt: isoOrEmpty(p.createdAt),
    })
  );

  return (
    <TaskManager
      initialProjects={initialProjects}
      initialPrompts={initialPrompts}
      initialSettings={initialSettings}
      initialQuotes={initialQuotes}
      initialInvoices={initialInvoices}
      initialReceipts={initialReceipts}
      initialSubscriptions={initialSubscriptions}
      initialSubscriptionPayments={initialSubscriptionPayments}
    />
  );
}

function toClientTask(t: {
  id: number;
  title: string;
  description: string;
  priority: string;
  tags: string[];
  dueDate: string;
  comments: number;
  attachments: number;
}) {
  return {
    id: t.id,
    title: t.title,
    desc: t.description,
    priority: t.priority as "High" | "Medium" | "Low",
    tags: Array.isArray(t.tags) ? t.tags : [],
    date: t.dueDate,
    comments: t.comments,
    attachments: t.attachments,
  };
}

function safeMap<T, U>(
  rows: T[],
  label: string,
  fn: (row: T) => U
): U[] {
  const out: U[] = [];
  for (const row of rows) {
    try {
      out.push(fn(row));
    } catch (err) {
      console.error(`[page.tsx] dropped malformed ${label} row:`, err, row);
    }
  }
  return out;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function relTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortDate(value: unknown): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isoOrEmpty(value: unknown): string {
  const d = toDate(value);
  return d ? d.toISOString() : "";
}

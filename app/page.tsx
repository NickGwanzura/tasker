import TaskManager from "./TaskManager";
import { loadAllData } from "./actions";

export const dynamic = "force-dynamic";

type ColKey = "todo" | "inprogress" | "inreview" | "done";

export default async function Page() {
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
  } = await loadAllData();

  // Group children by project for the client component
  const initialProjects = allProjects.map((p) => {
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
      name: p.name,
      desc: p.description,
      color: p.color,
      tasks: {
        todo: grouped.todo.map(toClientTask),
        inprogress: grouped.inprogress.map(toClientTask),
        inreview: grouped.inreview.map(toClientTask),
        done: grouped.done.map(toClientTask),
      },
      docs: allDocs
        .filter((d) => d.projectId === p.id)
        .map((d) => ({
          id: d.id,
          title: d.title,
          content: d.content,
          updated: relTime(d.updatedAt),
        })),
      activity: allActivities
        .filter((a) => a.projectId === p.id)
        .map((a) => ({
          icon: a.icon,
          text: a.text,
          time: relTime(a.createdAt),
        })),
    };
  });

  const initialPrompts = allPrompts.map((p) => ({
    title: p.title,
    text: p.text,
    category: p.category,
    date: p.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  }));

  const initialSettings = {
    displayName: appSettings.displayName,
    planLabel: appSettings.planLabel,
    theme: appSettings.theme,
    accentColor: appSettings.accentColor,
    defaultPriority: appSettings.defaultPriority,
    defaultColumn: appSettings.defaultColumn,
    density: appSettings.density,
  };

  const initialQuotes = allQuotes.map((q) => ({
    id: q.id,
    clientName: q.clientName,
    clientEmail: q.clientEmail,
    clientAddress: q.clientAddress,
    items: Array.isArray(q.items) ? q.items : [],
    subtotal: q.subtotal,
    tax: q.tax,
    total: q.total,
    status: q.status,
    notes: q.notes,
    createdAt: relTime(q.createdAt),
    updatedAt: relTime(q.updatedAt),
  }));

  const initialInvoices = allInvoices.map((i) => ({
    id: i.id,
    clientName: i.clientName,
    clientEmail: i.clientEmail,
    clientAddress: i.clientAddress,
    items: Array.isArray(i.items) ? i.items : [],
    subtotal: i.subtotal,
    tax: i.tax,
    total: i.total,
    status: i.status,
    dueDate: i.dueDate ? new Date(i.dueDate).toISOString() : "",
    notes: i.notes,
    createdAt: relTime(i.createdAt),
    updatedAt: relTime(i.updatedAt),
  }));

  const initialReceipts = allReceipts.map((r) => ({
    id: r.id,
    invoiceId: r.invoiceId,
    amount: r.amount,
    paymentMethod: r.paymentMethod,
    transactionId: r.transactionId,
    notes: r.notes,
    createdAt: relTime(r.createdAt),
  }));

  return (
    <TaskManager
      initialProjects={initialProjects}
      initialPrompts={initialPrompts}
      initialSettings={initialSettings}
      initialQuotes={initialQuotes}
      initialInvoices={initialInvoices}
      initialReceipts={initialReceipts}
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

function relTime(d: Date): string {
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

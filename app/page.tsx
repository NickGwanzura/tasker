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

  return (
    <TaskManager
      initialProjects={initialProjects}
      initialPrompts={initialPrompts}
      initialSettings={initialSettings}
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

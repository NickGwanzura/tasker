"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { projects, tasks, docPages, activities, prompts, settings } = schema;
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

// ---------- Loaders ----------
export async function loadAllData() {
  const [allProjects, allTasks, allDocs, allActivities, allPrompts, settingsRow] =
    await Promise.all([
      db.select().from(projects).orderBy(asc(projects.createdAt)),
      db.select().from(tasks).orderBy(asc(tasks.position), asc(tasks.id)),
      db.select().from(docPages).orderBy(asc(docPages.createdAt)),
      db.select().from(activities).orderBy(desc(activities.createdAt)),
      db.select().from(prompts).orderBy(desc(prompts.createdAt)),
      db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1),
    ]);
  let appSettings = settingsRow[0];
  if (!appSettings) {
    const inserted = await db
      .insert(settings)
      .values({ id: SETTINGS_ID })
      .returning();
    appSettings = inserted[0];
  }
  return {
    allProjects,
    allTasks,
    allDocs,
    allActivities,
    allPrompts,
    appSettings,
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
  const [allProjects, allTasks, allDocs, allActivities, allPrompts, settingsRow] =
    await Promise.all([
      db.select().from(projects),
      db.select().from(tasks),
      db.select().from(docPages),
      db.select().from(activities),
      db.select().from(prompts),
      db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1),
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
  };
}

export async function wipeAllDataAction() {
  // Cascade FKs handle children, but be explicit for safety + activities/prompts cleanup
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

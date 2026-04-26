"use server";

import { revalidatePath } from "next/cache";
import { eq, desc, asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { projects, tasks, docPages, activities, prompts } = schema;

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
  const [allProjects, allTasks, allDocs, allActivities, allPrompts] =
    await Promise.all([
      db.select().from(projects).orderBy(asc(projects.createdAt)),
      db.select().from(tasks).orderBy(asc(tasks.position), asc(tasks.id)),
      db.select().from(docPages).orderBy(asc(docPages.createdAt)),
      db.select().from(activities).orderBy(desc(activities.createdAt)),
      db.select().from(prompts).orderBy(desc(prompts.createdAt)),
    ]);
  return { allProjects, allTasks, allDocs, allActivities, allPrompts };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

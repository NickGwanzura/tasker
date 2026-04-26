"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  addPromptAction,
  addTaskAction,
  createProjectAction,
  deleteDocAction,
  newDocAction,
  updateDocAction,
} from "./actions";

// ---------- Types ----------
type ColKey = "todo" | "inprogress" | "inreview" | "done";
type Priority = "High" | "Medium" | "Low";

interface Task {
  id: number;
  title: string;
  desc: string;
  priority: Priority;
  tags: string[];
  date: string;
  comments: number;
  attachments: number;
}

interface DocPage {
  id: string;
  title: string;
  content: string;
  updated: string;
}

interface Activity {
  icon: string;
  text: string;
  time: string;
}

interface Project {
  id: string;
  name: string;
  desc: string;
  color: string;
  tasks: Record<ColKey, Task[]>;
  docs: DocPage[];
  activity: Activity[];
}

interface Prompt {
  title: string;
  text: string;
  category: string;
  date: string;
}

type PageKey =
  | "tasks"
  | "docs"
  | "reporting"
  | "prompts"
  | "security-overview"
  | "calendar"
  | "automations";

// ---------- Constants ----------
const SC: Record<ColKey, string> = {
  todo: "#3b5bdb",
  inprogress: "#e67700",
  inreview: "#6741d9",
  done: "#0ca678",
};
const SL: Record<ColKey, string> = {
  todo: "To Do",
  inprogress: "In Progress",
  inreview: "In Review",
  done: "Done",
};
const COLS: { key: ColKey; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "inprogress", label: "In Progress" },
  { key: "inreview", label: "In Review" },
  { key: "done", label: "Done" },
];
const CC: Record<string, { bg: string; text: string }> = {
  Development: { bg: "#edf0ff", text: "#3b5bdb" },
  Design: { bg: "#fce7f3", text: "#be185d" },
  Business: { bg: "#f3f0ff", text: "#6741d9" },
  AI: { bg: "#f0fdf4", text: "#166534" },
  Writing: { bg: "#fff4e6", text: "#c2410c" },
  Other: { bg: "#f1f5f9", text: "#475569" },
};
const CI: Record<string, string> = {
  Development: "💻",
  Design: "🎨",
  Business: "📈",
  AI: "🤖",
  Writing: "✍️",
  Other: "📌",
};
const TM: Record<string, string> = {
  "UI design": "tui",
  Interaction: "tui",
  Backend: "tbe",
  Tech: "ttc",
  QA: "tqa",
  Audit: "tau",
  Research: "tre",
  "Design System": "tds",
  Docs: "tdo",
  Aesthetics: "tae",
};
const PM: Record<Priority, string> = { High: "ph", Medium: "pm", Low: "pl2" };
const AVC = ["#3b5bdb", "#6741d9", "#0ca678", "#e67700", "#e03131"];
const PROJECT_COLORS = [
  "#3b5bdb",
  "#0ca678",
  "#e67700",
  "#6741d9",
  "#e03131",
  "#e8590c",
  "#be185d",
  "#0f766e",
];
const PT: Record<PageKey, string> = {
  tasks: "Tasks",
  docs: "Docs",
  reporting: "Reports",
  prompts: "Prompt Vault",
  "security-overview": "Security",
  calendar: "Calendar",
  automations: "Automations",
};

// ---------- Utils ----------
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mdToHtml(md: string): string {
  if (!md)
    return '<span style="color:var(--muted2);font-size:13px">Nothing to preview yet.</span>';
  const h = esc(md)
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]+?<\/li>)/g, "<ul>$1</ul>")
    .replace(
      /---/g,
      '<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">'
    )
    .replace(/\n\n/g, "</p><p>");
  return "<p>" + h + "</p>";
}

// ---------- Component ----------
interface TaskManagerProps {
  initialProjects: Project[];
  initialPrompts: Prompt[];
}

export default function TaskManager({
  initialProjects,
  initialPrompts,
}: TaskManagerProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [activeProjId, setActiveProjId] = useState<string | null>(
    initialProjects[0]?.id ?? null
  );
  const [activeDocProjId, setActiveDocProjId] = useState<string | null>(
    initialProjects[0]?.id ?? null
  );
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeReportProjId, setActiveReportProjId] = useState<string | null>(
    initialProjects[0]?.id ?? null
  );
  const [docEditMode, setDocEditMode] = useState(true);
  const [prompts, setPrompts] = useState<Prompt[]>(initialPrompts);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [page, setPage] = useState<PageKey>("tasks");
  const [tabActive, setTabActive] = useState<string>("Board");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const [openSecFolders, setOpenSecFolders] = useState<Record<string, boolean>>(
    {}
  );
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [pSearch, setPSearch] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Modal form state
  const [projForm, setProjForm] = useState({
    name: "",
    desc: "",
    color: "#3b5bdb",
  });
  const [taskForm, setTaskForm] = useState<{
    title: string;
    desc: string;
    priority: Priority;
    col: ColKey;
    tags: string;
    date: string;
  }>({
    title: "",
    desc: "",
    priority: "Medium",
    col: "todo",
    tags: "",
    date: "",
  });
  const [promptForm, setPromptForm] = useState({
    title: "",
    category: "Development",
    text: "",
  });

  const docTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const docTitleInputRef = useRef<HTMLInputElement | null>(null);

  const getProj = useCallback(
    (id: string | null) => projects.find((p) => p.id === id) ?? null,
    [projects]
  );

  const showToast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2600);
  }, []);

  const openModal = useCallback((id: string) => setOpenModalId(id), []);
  const closeModal = useCallback(() => setOpenModalId(null), []);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // ESC closes modals
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenModalId(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Re-sync local state when server-provided props change (after router.refresh)
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);
  useEffect(() => {
    setPrompts(initialPrompts);
  }, [initialPrompts]);

  // ---------- Project ops ----------
  const createProject = useCallback(() => {
    const name = projForm.name.trim();
    if (!name) {
      showToast("Enter a project name");
      return;
    }
    startTransition(async () => {
      const res = await createProjectAction({
        name,
        description: projForm.desc.trim(),
        color: projForm.color,
      });
      setActiveProjId(res.id);
      setProjForm({ name: "", desc: "", color: "#3b5bdb" });
      closeModal();
      showToast(`"${name}" created`);
      setPage("tasks");
      router.refresh();
    });
  }, [projForm, showToast, closeModal, router]);

  const switchProj = useCallback((id: string) => {
    setActiveProjId(id);
  }, []);

  // ---------- Task ops ----------
  const quickAdd = useCallback(
    (c: ColKey) => {
      setTaskForm((f) => ({ ...f, col: c }));
      openModal("mTask");
    },
    [openModal]
  );

  const addTask = useCallback(() => {
    const title = taskForm.title.trim();
    if (!title) {
      showToast("Enter a task title");
      return;
    }
    if (!activeProjId) {
      showToast("Select a project first");
      return;
    }
    const tags = taskForm.tags
      ? taskForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : ["Task"];
    startTransition(async () => {
      await addTaskAction({
        projectId: activeProjId,
        title,
        description: taskForm.desc.trim(),
        priority: taskForm.priority,
        column: taskForm.col,
        tags,
        dueDate: taskForm.date || "No date",
      });
      setTaskForm({
        title: "",
        desc: "",
        priority: "Medium",
        col: taskForm.col,
        tags: "",
        date: "",
      });
      closeModal();
      showToast("Task added");
      router.refresh();
    });
  }, [taskForm, activeProjId, showToast, closeModal, router]);

  // ---------- Doc ops ----------
  const switchDocProj = useCallback((id: string) => {
    setActiveDocProjId(id);
    setActiveDocId(null);
    setDocEditMode(true);
  }, []);

  const newDoc = useCallback(() => {
    if (!activeDocProjId) {
      showToast("Select a project first");
      return;
    }
    startTransition(async () => {
      const res = await newDocAction({ projectId: activeDocProjId });
      setActiveDocId(res.id);
      setDocEditMode(true);
      router.refresh();
      setTimeout(() => docTitleInputRef.current?.focus(), 80);
    });
  }, [activeDocProjId, showToast, router]);

  const openDoc = useCallback((id: string) => {
    setActiveDocId(id);
    setDocEditMode(true);
  }, []);

  const deleteDoc = useCallback(
    (e: MouseEvent, id: string) => {
      e.stopPropagation();
      if (!activeDocProjId) return;
      // Optimistic local removal so UI feels snappy
      setProjects((ps) =>
        ps.map((p) =>
          p.id === activeDocProjId
            ? { ...p, docs: p.docs.filter((d) => d.id !== id) }
            : p
        )
      );
      setActiveDocId((cur) => (cur === id ? null : cur));
      showToast("Page deleted");
      startTransition(async () => {
        await deleteDocAction({ id });
        router.refresh();
      });
    },
    [activeDocProjId, showToast, router]
  );

  // Debounced save: keep local state instant, persist after pause
  const docSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueDocSave = useCallback(
    (id: string, patch: { title?: string; content?: string }) => {
      if (docSaveTimer.current) clearTimeout(docSaveTimer.current);
      docSaveTimer.current = setTimeout(() => {
        startTransition(async () => {
          await updateDocAction({ id, ...patch });
        });
      }, 600);
    },
    []
  );

  const updateDocTitle = useCallback(
    (v: string) => {
      if (!activeDocProjId || !activeDocId) return;
      setProjects((ps) =>
        ps.map((p) =>
          p.id === activeDocProjId
            ? {
                ...p,
                docs: p.docs.map((d) =>
                  d.id === activeDocId
                    ? { ...d, title: v, updated: "Just now" }
                    : d
                ),
              }
            : p
        )
      );
      queueDocSave(activeDocId, { title: v });
    },
    [activeDocProjId, activeDocId, queueDocSave]
  );

  const saveDocContent = useCallback(
    (v: string) => {
      if (!activeDocProjId || !activeDocId) return;
      setProjects((ps) =>
        ps.map((p) =>
          p.id === activeDocProjId
            ? {
                ...p,
                docs: p.docs.map((d) =>
                  d.id === activeDocId
                    ? { ...d, content: v, updated: "Just now" }
                    : d
                ),
              }
            : p
        )
      );
      queueDocSave(activeDocId, { content: v });
    },
    [activeDocProjId, activeDocId, queueDocSave]
  );

  const togglePreview = useCallback(() => setDocEditMode((v) => !v), []);

  const insMd = useCallback(
    (before: string, after = "") => {
      const ta = docTextareaRef.current;
      if (!ta) return;
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      const sel = ta.value.substring(s, e);
      const newVal =
        ta.value.substring(0, s) + before + sel + after + ta.value.substring(e);
      ta.value = newVal;
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
      ta.focus();
      saveDocContent(newVal);
    },
    [saveDocContent]
  );

  // ---------- Prompt ops ----------
  const addPrompt = useCallback(() => {
    const title = promptForm.title.trim();
    const text = promptForm.text.trim();
    if (!title || !text) {
      showToast("Fill in title and prompt text");
      return;
    }
    startTransition(async () => {
      await addPromptAction({ title, text, category: promptForm.category });
      setPromptForm({ title: "", category: "Development", text: "" });
      closeModal();
      showToast("Prompt saved");
      router.refresh();
    });
  }, [promptForm, showToast, closeModal, router]);

  const filteredPrompts = useMemo(() => {
    let list =
      activeCat === "all" ? prompts : prompts.filter((p) => p.category === activeCat);
    const q = pSearch.toLowerCase();
    if (q)
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) || p.text.toLowerCase().includes(q)
      );
    return list;
  }, [activeCat, prompts, pSearch]);

  const copyPrompt = useCallback((idx: number, text: string) => {
    navigator.clipboard.writeText(text || "").then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  }, []);

  // ---------- Nav ----------
  const navTo = useCallback((target: PageKey) => {
    setPage(target);
    setSidebarOpen(false);
  }, []);

  // Sync default doc/report project ids when projects change
  useEffect(() => {
    if (projects.length === 0) return;
    if (!activeDocProjId) setActiveDocProjId(projects[0].id);
    if (!activeReportProjId) setActiveReportProjId(projects[0].id);
  }, [projects, activeDocProjId, activeReportProjId]);

  // ---------- Derived ----------
  const activeProj = getProj(activeProjId);
  const taskTotal = activeProj
    ? Object.values(activeProj.tasks).reduce((s, a) => s + a.length, 0)
    : 0;

  // ---------- Render ----------
  return (
    <>
      <div
        className={"s-overlay" + (sidebarOpen ? " open" : "")}
        onClick={closeSidebar}
      />

      {/* SIDEBAR */}
      <aside className={"sidebar" + (sidebarOpen ? " open" : "")}>
        <div className="s-user">
          <div className="av">NG</div>
          <div>
            <div className="s-name">Nicholas Gwanzura</div>
            <div className="s-plan">Pro plan</div>
          </div>
          <button className="s-close" onClick={closeSidebar}>
            ✕
          </button>
        </div>
        <div className="s-search">
          <input type="text" placeholder="Search..." />
        </div>

        <div className="s-sec">
          <div className="s-lbl">Essentials</div>
          <div
            className={"ni" + (page === "tasks" ? " active" : "")}
            onClick={() => navTo("tasks")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
            Tasks <span className="n-badge">{taskTotal}</span>
          </div>
          <div
            className={"ni" + (page === "calendar" ? " active" : "")}
            onClick={() => navTo("calendar")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Calendar
          </div>
          <div
            className={"ni" + (page === "prompts" ? " active" : "")}
            onClick={() => navTo("prompts")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            Prompt Vault{" "}
            <span className="n-badge" style={{ background: "#6741d9" }}>
              {prompts.length}
            </span>
          </div>
        </div>

        <div className="s-sec">
          <div className="s-lbl">Projects</div>
          <div>
            {projects.length === 0 ? (
              <div
                style={{
                  padding: "6px 16px",
                  fontSize: 12,
                  color: "var(--muted2)",
                }}
              >
                No projects yet
              </div>
            ) : (
              projects.map((p) => (
                <div
                  key={p.id}
                  className={"ni" + (activeProjId === p.id ? " active" : "")}
                  onClick={() => switchProj(p.id)}
                >
                  <div className="n-dot" style={{ background: p.color }} />
                  {p.name}
                </div>
              ))
            )}
          </div>
          <button className="add-proj-btn" onClick={() => openModal("mProject")}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Project
          </button>
        </div>

        <div className="s-sec">
          <div className="s-lbl">Workspace</div>
          <div
            className={"ni" + (page === "docs" ? " active" : "")}
            onClick={() => navTo("docs")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Docs
          </div>
          <div
            className={"ni" + (page === "reporting" ? " active" : "")}
            onClick={() => navTo("reporting")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Reports
          </div>
          <div
            className={"ni" + (page === "automations" ? " active" : "")}
            onClick={() => navTo("automations")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Automations
          </div>
        </div>

        <SecuritySection
          openSecFolders={openSecFolders}
          setOpenSecFolders={setOpenSecFolders}
        />

        <div className="s-sec" style={{ paddingBottom: 16 }}>
          <div className="s-lbl">Apps</div>
          <div className="ni">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
            Settings
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="main">
        <div className="topbar">
          <button className="t-menu" onClick={openSidebar}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="t-title">{PT[page] || page}</div>
          {page === "tasks" && (
            <div className="t-tabs">
              {["Board", "Lists", "Timeline"].map((t) => (
                <button
                  key={t}
                  className={"tab" + (tabActive === t ? " active" : "")}
                  onClick={() => setTabActive(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <TopbarButtons
            page={page}
            openModal={openModal}
            newDoc={newDoc}
          />
        </div>

        <div className={"page" + (page === "tasks" ? " active" : "")}>
          <TasksView
            project={activeProj}
            quickAdd={quickAdd}
            openProjectModal={() => openModal("mProject")}
          />
        </div>

        <div className={"page" + (page === "docs" ? " active" : "")}>
          <DocsView
            projects={projects}
            activeDocProjId={activeDocProjId}
            activeDocId={activeDocId}
            docEditMode={docEditMode}
            switchDocProj={switchDocProj}
            openDoc={openDoc}
            newDoc={newDoc}
            deleteDoc={deleteDoc}
            updateDocTitle={updateDocTitle}
            saveDocContent={saveDocContent}
            togglePreview={togglePreview}
            insMd={insMd}
            openProjectModal={() => openModal("mProject")}
            docTextareaRef={docTextareaRef}
            docTitleInputRef={docTitleInputRef}
          />
        </div>

        <div className={"page" + (page === "reporting" ? " active" : "")}>
          <ReportsView
            projects={projects}
            activeReportProjId={activeReportProjId}
            switchReport={(id) => setActiveReportProjId(id)}
            openProjectModal={() => openModal("mProject")}
          />
        </div>

        <div className={"page" + (page === "prompts" ? " active" : "")}>
          <PromptsView
            prompts={filteredPrompts}
            allCount={prompts.length}
            activeCat={activeCat}
            setActiveCat={setActiveCat}
            pSearch={pSearch}
            setPSearch={setPSearch}
            copyPrompt={copyPrompt}
            copiedIdx={copiedIdx}
            openPromptModal={() => openModal("mPrompt")}
          />
        </div>

        <div
          className={
            "page" + (page === "security-overview" ? " active" : "")
          }
        >
          <div className="sec-pg">
            <div className="sec-ico">🛡️</div>
            <div className="sec-tit">App Security Center</div>
            <div className="sec-sub">
              Monitor, audit and manage your application security posture from
              one place.
            </div>
            <div className="sec-cards">
              <div className="sc">
                <div className="sc-ico">🔐</div>
                <div className="sc-tit">Auth &amp; Access</div>
                <div className="sc-desc">Login flows, roles and MFA</div>
              </div>
              <div className="sc">
                <div className="sc-ico">🔍</div>
                <div className="sc-tit">Vulnerabilities</div>
                <div className="sc-desc">CVE tracking and patches</div>
              </div>
              <div className="sc">
                <div className="sc-ico">📋</div>
                <div className="sc-tit">Audit Logs</div>
                <div className="sc-desc">Activity and session records</div>
              </div>
              <div className="sc">
                <div className="sc-ico">✅</div>
                <div className="sc-tit">Compliance</div>
                <div className="sc-desc">GDPR and data policies</div>
              </div>
              <div className="sc">
                <div className="sc-ico">🖥️</div>
                <div className="sc-tit">Infra Security</div>
                <div className="sc-desc">Firewall, SSL, rate limits</div>
              </div>
            </div>
          </div>
        </div>

        <div className={"page" + (page === "calendar" ? " active" : "")}>
          <div className="sec-pg">
            <div className="sec-ico">📅</div>
            <div className="sec-tit">Calendar</div>
            <div className="sec-sub">Timeline view coming soon.</div>
          </div>
        </div>

        <div className={"page" + (page === "automations" ? " active" : "")}>
          <div className="sec-pg">
            <div className="sec-ico">⚡</div>
            <div className="sec-tit">Automations</div>
            <div className="sec-sub">Workflow automation coming soon.</div>
          </div>
        </div>
      </div>

      {/* BOTTOM NAV (mobile) */}
      <nav className="bnav">
        <button
          className={"bn-item" + (page === "tasks" ? " active" : "")}
          onClick={() => navTo("tasks")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
          </svg>
          Tasks<span className="bn-badge">{taskTotal}</span>
        </button>
        <button
          className={"bn-item" + (page === "docs" ? " active" : "")}
          onClick={() => navTo("docs")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          Docs
        </button>
        <button className="bn-item" onClick={() => openModal("mProject")}>
          <svg width="22" height="22" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="11" fill="#3b5bdb" />
            <line x1="12" y1="7" x2="12" y2="17" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="7" y1="12" x2="17" y2="12" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
          New
        </button>
        <button
          className={"bn-item" + (page === "reporting" ? " active" : "")}
          onClick={() => navTo("reporting")}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Reports
        </button>
        <button className="bn-item" onClick={openSidebar}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          More
        </button>
      </nav>

      {/* MODALS */}
      <Modal
        id="mProject"
        open={openModalId === "mProject"}
        onBackdrop={closeModal}
      >
        <div className="m-title">New Project</div>
        <div className="fg">
          <label className="fl">Project Name</label>
          <input
            type="text"
            className="fi"
            placeholder="e.g. HEVACRAZ Platform"
            value={projForm.name}
            onChange={(e) => setProjForm({ ...projForm, name: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Description</label>
          <textarea
            className="ft"
            placeholder="What is this project about?"
            style={{ minHeight: 70 }}
            value={projForm.desc}
            onChange={(e) => setProjForm({ ...projForm, desc: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Color</label>
          <div className="color-picker">
            {PROJECT_COLORS.map((c) => (
              <div
                key={c}
                className={
                  "color-swatch" + (projForm.color === c ? " selected" : "")
                }
                style={{ background: c }}
                onClick={() => setProjForm({ ...projForm, color: c })}
              />
            ))}
          </div>
        </div>
        <div className="m-acts">
          <button className="btn bg" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn bp" onClick={createProject}>
            Create Project
          </button>
        </div>
      </Modal>

      <Modal
        id="mTask"
        open={openModalId === "mTask"}
        onBackdrop={closeModal}
      >
        <div className="m-title">New Task</div>
        <div className="fg">
          <label className="fl">Title</label>
          <input
            type="text"
            className="fi"
            placeholder="What needs to be done?"
            value={taskForm.title}
            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
          />
        </div>
        <div className="fg">
          <label className="fl">Description</label>
          <textarea
            className="ft"
            placeholder="Describe the task..."
            style={{ minHeight: 72 }}
            value={taskForm.desc}
            onChange={(e) => setTaskForm({ ...taskForm, desc: e.target.value })}
          />
        </div>
        <div className="frow">
          <div className="fg">
            <label className="fl">Priority</label>
            <select
              className="fs"
              value={taskForm.priority}
              onChange={(e) =>
                setTaskForm({
                  ...taskForm,
                  priority: e.target.value as Priority,
                })
              }
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div className="fg">
            <label className="fl">Column</label>
            <select
              className="fs"
              value={taskForm.col}
              onChange={(e) =>
                setTaskForm({ ...taskForm, col: e.target.value as ColKey })
              }
            >
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="inreview">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
        <div className="frow">
          <div className="fg">
            <label className="fl">Tags</label>
            <input
              type="text"
              className="fi"
              placeholder="UI design, Backend"
              value={taskForm.tags}
              onChange={(e) =>
                setTaskForm({ ...taskForm, tags: e.target.value })
              }
            />
          </div>
          <div className="fg">
            <label className="fl">Due Date</label>
            <input
              type="text"
              className="fi"
              placeholder="e.g. July 10"
              value={taskForm.date}
              onChange={(e) =>
                setTaskForm({ ...taskForm, date: e.target.value })
              }
            />
          </div>
        </div>
        <div className="m-acts">
          <button className="btn bg" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn bp" onClick={addTask}>
            Add Task
          </button>
        </div>
      </Modal>

      <Modal
        id="mPrompt"
        open={openModalId === "mPrompt"}
        onBackdrop={closeModal}
      >
        <div className="m-title">Save Prompt</div>
        <div className="fg">
          <label className="fl">Title</label>
          <input
            type="text"
            className="fi"
            placeholder="Name your prompt..."
            value={promptForm.title}
            onChange={(e) =>
              setPromptForm({ ...promptForm, title: e.target.value })
            }
          />
        </div>
        <div className="fg">
          <label className="fl">Category</label>
          <select
            className="fs"
            value={promptForm.category}
            onChange={(e) =>
              setPromptForm({ ...promptForm, category: e.target.value })
            }
          >
            <option value="Development">Development</option>
            <option value="Design">Design</option>
            <option value="Business">Business</option>
            <option value="AI">AI</option>
            <option value="Writing">Writing</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="fg">
          <label className="fl">Prompt Text</label>
          <textarea
            className="ft"
            placeholder="Paste your prompt here..."
            value={promptForm.text}
            onChange={(e) =>
              setPromptForm({ ...promptForm, text: e.target.value })
            }
          />
        </div>
        <div className="m-acts">
          <button className="btn bg" onClick={closeModal}>
            Cancel
          </button>
          <button className="btn bp" onClick={addPrompt}>
            Save Prompt
          </button>
        </div>
      </Modal>

      {/* TOASTS */}
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.msg}
        </div>
      ))}
    </>
  );
}

// ---------- Subcomponents ----------

function TopbarButtons({
  page,
  openModal,
  newDoc,
}: {
  page: PageKey;
  openModal: (id: string) => void;
  newDoc: () => void;
}) {
  if (page === "tasks") {
    return (
      <>
        <button className="btn bg" onClick={() => openModal("mTask")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Task</span>
        </button>
        <button className="btn bp" onClick={() => openModal("mPrompt")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span>Add Prompt</span>
        </button>
      </>
    );
  }
  if (page === "docs") {
    return (
      <button className="btn bp" onClick={newDoc}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New Page</span>
      </button>
    );
  }
  if (page === "prompts") {
    return (
      <button className="btn bp" onClick={() => openModal("mPrompt")}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        <span>New Prompt</span>
      </button>
    );
  }
  return null;
}

function SecuritySection({
  openSecFolders,
  setOpenSecFolders,
}: {
  openSecFolders: Record<string, boolean>;
  setOpenSecFolders: (
    fn: (prev: Record<string, boolean>) => Record<string, boolean>
  ) => void;
}) {
  const folders = [
    {
      id: "vuln-f",
      label: "Vulnerability Mgmt",
      kids: ["Pen Testing Logs", "CVE Tracker", "Patch Status"],
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
    },
    {
      id: "audit-f",
      label: "Audit Logs",
      kids: ["Activity Timeline", "Session Logs"],
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
    {
      id: "comp-f",
      label: "Compliance",
      kids: ["GDPR Checklist", "Data Policies", "Security Reports"],
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      ),
    },
    {
      id: "infra-f",
      label: "Infra Security",
      kids: ["Firewall Rules", "SSL Certs", "API Rate Limits", "Secrets Management"],
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      ),
    },
  ];

  const toggle = (id: string) =>
    setOpenSecFolders((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="s-sec">
      <div className="s-lbl">App Security</div>
      {folders.map((f) => (
        <div key={f.id}>
          <div className="ni" onClick={() => toggle(f.id)}>
            {f.icon}
            {f.label}
            <span className={"chev" + (openSecFolders[f.id] ? " open" : "")}>
              ›
            </span>
          </div>
          <div className={"sf-kids" + (openSecFolders[f.id] ? " open" : "")}>
            {f.kids.map((k) => (
              <div key={k} className="sf-item">
                {k}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TasksView({
  project,
  quickAdd,
  openProjectModal,
}: {
  project: Project | null;
  quickAdd: (c: ColKey) => void;
  openProjectModal: () => void;
}) {
  if (!project) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="no-proj">
          <div className="no-proj-ico">📋</div>
          <div className="no-proj-tit">No project selected</div>
          <div className="no-proj-sub">
            Create or select a project from the sidebar to manage tasks.
          </div>
          <button
            className="btn bp"
            style={{ marginTop: 8 }}
            onClick={openProjectModal}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>{" "}
            New Project
          </button>
        </div>
      </div>
    );
  }
  const total = Object.values(project.tasks).reduce((s, a) => s + a.length, 0);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="stats">
        <div className="chip">
          <strong>{total}</strong> total
        </div>
        <div className="chip">
          <strong>{project.tasks.inprogress.length}</strong> in progress
        </div>
        <div className="chip">
          <strong>{project.tasks.inreview.length}</strong> in review
        </div>
        <div className="chip">
          <strong>{project.tasks.done.length}</strong> done
        </div>
      </div>
      <div className="board">
        {COLS.map((c) => {
          const ct = project.tasks[c.key] || [];
          return (
            <div className="col" key={c.key}>
              <div className="col-hd">
                <div className="col-dot" style={{ background: SC[c.key] }} />
                <div className="col-tit">{c.label}</div>
                <div className="col-cnt">{ct.length}</div>
                <button className="col-add" onClick={() => quickAdd(c.key)}>
                  +
                </button>
              </div>
              <div>
                {ct.map((t) => (
                  <Card key={t.id} task={t} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({ task }: { task: Task }) {
  return (
    <div className="card">
      <div className="c-tags">
        <span className={"tag " + PM[task.priority]}>{task.priority}</span>
        {task.tags.map((x, i) => (
          <span key={i} className={"tag " + (TM[x] || "tui")}>
            {x}
          </span>
        ))}
      </div>
      <div className="c-title">{task.title}</div>
      <div className="c-desc">{task.desc}</div>
      <div className="c-foot">
        <div className="c-avs">
          {[0, 1].map((i) => (
            <div key={i} className="c-av" style={{ background: AVC[i] }}>
              U
            </div>
          ))}
        </div>
        <span className="c-date">{task.date}</span>
        <span className="c-stat" style={{ marginLeft: "auto" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          {task.comments}
        </span>
        <span className="c-stat">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.64 16.34a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          +{task.attachments}
        </span>
      </div>
    </div>
  );
}

function DocsView({
  projects,
  activeDocProjId,
  activeDocId,
  docEditMode,
  switchDocProj,
  openDoc,
  newDoc,
  deleteDoc,
  updateDocTitle,
  saveDocContent,
  togglePreview,
  insMd,
  openProjectModal,
  docTextareaRef,
  docTitleInputRef,
}: {
  projects: Project[];
  activeDocProjId: string | null;
  activeDocId: string | null;
  docEditMode: boolean;
  switchDocProj: (id: string) => void;
  openDoc: (id: string) => void;
  newDoc: () => void;
  deleteDoc: (e: MouseEvent, id: string) => void;
  updateDocTitle: (v: string) => void;
  saveDocContent: (v: string) => void;
  togglePreview: () => void;
  insMd: (before: string, after?: string) => void;
  openProjectModal: () => void;
  docTextareaRef: React.MutableRefObject<HTMLTextAreaElement | null>;
  docTitleInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  if (projects.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="no-proj">
          <div className="no-proj-ico">📄</div>
          <div className="no-proj-tit">No projects yet</div>
          <div className="no-proj-sub">
            Create a project first to start building documentation.
          </div>
          <button
            className="btn bp"
            style={{ marginTop: 8 }}
            onClick={openProjectModal}
          >
            New Project
          </button>
        </div>
      </div>
    );
  }
  const proj = projects.find((p) => p.id === activeDocProjId) ?? projects[0];
  const doc = activeDocId ? proj.docs.find((d) => d.id === activeDocId) : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="docs-proj-tabs">
        {projects.map((p) => (
          <button
            key={p.id}
            className={"tab" + (proj.id === p.id ? " active" : "")}
            onClick={() => switchDocProj(p.id)}
            style={{ fontSize: "11.5px", padding: "4px 9px" }}
          >
            <span
              style={{
                display: "inline-block",
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: p.color,
                marginRight: 5,
              }}
            />
            {p.name}
          </button>
        ))}
      </div>
      <div className="docs-layout">
        <div className="docs-sidebar">
          <div className="docs-sidebar-hd">
            <span className="docs-sidebar-title">Pages ({proj.docs.length})</span>
            <button className="docs-new-btn" onClick={newDoc}>
              +
            </button>
          </div>
          {proj.docs.length === 0 ? (
            <div className="docs-empty">
              No pages yet.
              <br />
              Click + to create your first page.
            </div>
          ) : (
            proj.docs.map((d) => (
              <div
                key={d.id}
                className={"doc-item" + (activeDocId === d.id ? " active" : "")}
                onClick={() => openDoc(d.id)}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="doc-item-name">{d.title || "Untitled"}</span>
                <button
                  className="doc-item-del"
                  onClick={(e) => deleteDoc(e, d.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
        <div className="doc-editor-area">
          {doc ? (
            <>
              <div className="doc-editor-topbar">
                <input
                  ref={docTitleInputRef}
                  className="doc-title-input"
                  value={doc.title}
                  placeholder="Untitled Page"
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateDocTitle(e.target.value)
                  }
                />
                <span className="doc-meta">{doc.updated}</span>
                <button
                  className="btn bg"
                  style={{ fontSize: "11.5px", padding: "5px 10px" }}
                  onClick={togglePreview}
                >
                  {docEditMode ? "Preview" : "Edit"}
                </button>
              </div>
              <div className="doc-toolbar">
                <button className="doc-tb-btn" onClick={() => insMd("# ")}>
                  H1
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("## ")}>
                  H2
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("### ")}>
                  H3
                </button>
                <div className="doc-tb-sep" />
                <button
                  className="doc-tb-btn"
                  onClick={() => insMd("**", "**")}
                >
                  <b>B</b>
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("*", "*")}>
                  <i>I</i>
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("`", "`")}>
                  Code
                </button>
                <div className="doc-tb-sep" />
                <button className="doc-tb-btn" onClick={() => insMd("- ")}>
                  List
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("> ")}>
                  Quote
                </button>
                <button className="doc-tb-btn" onClick={() => insMd("---\n")}>
                  HR
                </button>
              </div>
              <div className="doc-content-wrap">
                <div className="doc-content">
                  <textarea
                    ref={docTextareaRef}
                    className="doc-textarea"
                    placeholder={
                      "Start writing in Markdown...\n\n# Heading\n**Bold**, *italic*, `code`\n\n- List item"
                    }
                    value={doc.content}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      saveDocContent(e.target.value)
                    }
                    style={{ display: docEditMode ? "block" : "none" }}
                  />
                  <div
                    className="doc-preview"
                    style={{ display: docEditMode ? "none" : "block" }}
                    dangerouslySetInnerHTML={{ __html: mdToHtml(doc.content) }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="doc-placeholder">
              <div className="doc-placeholder-ico">📝</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--text)",
                  marginBottom: 6,
                }}
              >
                Select or create a page
              </div>
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--muted2)",
                  marginBottom: 16,
                }}
              >
                Pick a page from the left panel or create a new one.
              </div>
              <button className="btn bp" onClick={newDoc}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>{" "}
                New Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsView({
  projects,
  activeReportProjId,
  switchReport,
  openProjectModal,
}: {
  projects: Project[];
  activeReportProjId: string | null;
  switchReport: (id: string) => void;
  openProjectModal: () => void;
}) {
  if (projects.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="no-proj">
          <div className="no-proj-ico">📊</div>
          <div className="no-proj-tit">No projects yet</div>
          <div className="no-proj-sub">
            Create a project to start seeing reports.
          </div>
          <button
            className="btn bp"
            style={{ marginTop: 8 }}
            onClick={openProjectModal}
          >
            New Project
          </button>
        </div>
      </div>
    );
  }
  const proj = projects.find((p) => p.id === activeReportProjId) ?? projects[0];
  const t = proj.tasks;
  const total = Object.values(t).reduce((s, a) => s + a.length, 0);
  const done = t.done.length;
  const inprog = t.inprogress.length;
  const inrev = t.inreview.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const allT: (Task & { st: ColKey })[] = [
    ...t.todo.map((x) => ({ ...x, st: "todo" as ColKey })),
    ...t.inprogress.map((x) => ({ ...x, st: "inprogress" as ColKey })),
    ...t.inreview.map((x) => ({ ...x, st: "inreview" as ColKey })),
    ...t.done.map((x) => ({ ...x, st: "done" as ColKey })),
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="reports-wrap">
        <div className="report-header">
          <div className="report-title">📊 {proj.name}</div>
          <div className="report-proj-pick">
            {projects.map((p) => (
              <button
                key={p.id}
                className={"rpb" + (proj.id === p.id ? " active" : "")}
                onClick={() => switchReport(p.id)}
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: p.color,
                    display: "inline-block",
                  }}
                />
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="report-grid">
          <Stat
            label="Total Tasks"
            val={total}
            sub={`${t.todo.length} remaining`}
            fill={100}
            color="var(--accent)"
          />
          <Stat
            label="Completion"
            val={`${pct}%`}
            sub={`${done} of ${total} done`}
            fill={pct}
            color="var(--green)"
          />
          <Stat
            label="In Progress"
            val={inprog}
            sub={`${inrev} in review`}
            fill={total ? Math.round((inprog / total) * 100) : 0}
            color="var(--yellow)"
          />
          <Stat
            label="Doc Pages"
            val={proj.docs.length}
            sub="for this project"
            fill={Math.min(proj.docs.length * 10, 100)}
            color="var(--purple)"
          />
        </div>
        <div className="report-two-col">
          <div className="report-section">
            <div className="rs-title">
              Task Breakdown<span>by status</span>
            </div>
            {COLS.map((c) => {
              const cnt = t[c.key].length;
              const p2 = total ? Math.round((cnt / total) * 100) : 0;
              return (
                <div className="progress-item" key={c.key}>
                  <div className="pi-head">
                    <span className="pi-label">{c.label}</span>
                    <span className="pi-pct">
                      {cnt} ({p2}%)
                    </span>
                  </div>
                  <div className="pi-bar">
                    <div
                      className="pi-fill"
                      style={{ width: `${p2}%`, background: SC[c.key] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="report-section">
            <div className="rs-title">
              Recent Activity<span>{(proj.activity || []).length} events</span>
            </div>
            {(proj.activity || []).length === 0 ? (
              <div
                style={{
                  padding: "12px 0",
                  color: "var(--muted2)",
                  fontSize: "12.5px",
                  textAlign: "center",
                }}
              >
                No activity yet
              </div>
            ) : (
              proj.activity.slice(0, 6).map((a, i) => (
                <div className="activity-row" key={i}>
                  <div className="act-icon">{a.icon}</div>
                  <div
                    className="act-text"
                    dangerouslySetInnerHTML={{ __html: a.text }}
                  />
                  <span className="act-time">{a.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="report-section">
          <div className="rs-title">
            All Tasks<span>{total} total</span>
          </div>
          {allT.length === 0 ? (
            <div
              style={{
                padding: "12px 0",
                color: "var(--muted2)",
                fontSize: "12.5px",
                textAlign: "center",
              }}
            >
              No tasks yet
            </div>
          ) : (
            allT.slice(0, 10).map((x) => (
              <div className="task-row" key={x.id}>
                <div className="tr-status" style={{ background: SC[x.st] }} />
                <div className="tr-title">{x.title}</div>
                <span
                  className={"tag " + PM[x.priority]}
                  style={{ fontSize: 10 }}
                >
                  {x.priority}
                </span>
                <span className="tr-date">{x.date}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  val,
  sub,
  fill,
  color,
}: {
  label: string;
  val: string | number;
  sub: string;
  fill: number;
  color: string;
}) {
  return (
    <div className="r-stat">
      <div className="r-stat-label">{label}</div>
      <div className="r-stat-val">{val}</div>
      <div className="r-stat-sub">{sub}</div>
      <div className="r-stat-bar">
        <div
          className="r-stat-fill"
          style={{ width: `${fill}%`, background: color }}
        />
      </div>
    </div>
  );
}

function PromptsView({
  prompts,
  allCount,
  activeCat,
  setActiveCat,
  pSearch,
  setPSearch,
  copyPrompt,
  copiedIdx,
  openPromptModal,
}: {
  prompts: Prompt[];
  allCount: number;
  activeCat: string;
  setActiveCat: (c: string) => void;
  pSearch: string;
  setPSearch: (v: string) => void;
  copyPrompt: (idx: number, text: string) => void;
  copiedIdx: number | null;
  openPromptModal: () => void;
}) {
  const cats = ["all", "Development", "Design", "Business", "AI"] as const;
  const labels: Record<string, string> = {
    all: "All",
    Development: "Dev",
    Design: "Design",
    Business: "Biz",
    AI: "AI",
  };
  return (
    <div className="vault">
      <div className="v-bar">
        <input
          type="text"
          className="v-search"
          placeholder="Search prompts..."
          value={pSearch}
          onChange={(e) => setPSearch(e.target.value)}
        />
        <div className="v-filters">
          {cats.map((c) => (
            <button
              key={c}
              className={"fb" + (activeCat === c ? " active" : "")}
              onClick={() => setActiveCat(c)}
            >
              {labels[c]}
            </button>
          ))}
        </div>
        <button className="btn bp" onClick={openPromptModal}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New</span>
        </button>
      </div>
      <div className="v-grid">
        {prompts.length === 0 ? (
          <div className="empty">
            <div className="e-ico">💬</div>
            <div className="e-tit">
              {allCount === 0 ? "No prompts yet" : "No prompts match"}
            </div>
            <div className="e-txt">
              Save your daily prompts for quick reuse.
            </div>
          </div>
        ) : (
          prompts.map((p, i) => {
            const c = CC[p.category] || CC.Other;
            const style: CSSProperties = { animationDelay: `${i * 0.04}s` };
            return (
              <div className="pc" key={i} style={style}>
                <div className="pc-top">
                  <div className="p-icon" style={{ background: c.bg }}>
                    {CI[p.category] || "📌"}
                  </div>
                  <div className="pc-meta">
                    <div className="p-title">{p.title}</div>
                    <div>
                      <span
                        className="p-cat"
                        style={{ background: c.bg, color: c.text }}
                      >
                        {p.category}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-body">{p.text}</div>
                <div className="p-foot">
                  <span className="p-date">{p.date}</span>
                  <button
                    className={"p-copy" + (copiedIdx === i ? " copied" : "")}
                    onClick={() => copyPrompt(i, p.text)}
                  >
                    {copiedIdx === i ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Modal({
  id,
  open,
  onBackdrop,
  children,
}: {
  id: string;
  open: boolean;
  onBackdrop: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={"mo" + (open ? " open" : "")}
      id={id}
      onClick={(e) => {
        if (e.target === e.currentTarget) onBackdrop();
      }}
    >
      <div className="modal">{children}</div>
    </div>
  );
}

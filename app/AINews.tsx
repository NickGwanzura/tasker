"use client";

import { useEffect, useState, useTransition } from "react";
import { fetchAINewsAction, type NewsItem } from "./actions";

const CATEGORIES: { key: string; label: string; match?: (n: NewsItem) => boolean }[] = [
  { key: "all", label: "All" },
  {
    key: "releases",
    label: "Releases",
    match: (n) =>
      /release|launch|announc|new model|update|version|claude \d|gpt-?\d|gemini \d+|llama \d|sonnet|opus|haiku|mistral|o\d\b/i.test(
        n.title
      ),
  },
  {
    key: "benchmarks",
    label: "Benchmarks",
    match: (n) =>
      /benchmark|eval|leaderboard|arena|score|mmlu|swe-bench|humaneval|helm|compare|comparison|performance|test|rank/i.test(
        n.title
      ),
  },
  {
    key: "research",
    label: "Research",
    match: (n) =>
      /paper|arxiv|preprint|research|study|training|fine.?tun|alignment|safety|reasoning|rlhf|scaling|architecture/i.test(
        n.title
      ),
  },
];

function relTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AINews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [cat, setCat] = useState<string>("all");

  const refresh = () => {
    startTransition(async () => {
      const res = await fetchAINewsAction();
      setItems(res.items);
      setFetchedAt(res.fetchedAt);
      setError(res.error);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCat = CATEGORIES.find((c) => c.key === cat);
  const visible =
    !activeCat || cat === "all" || !activeCat.match
      ? items
      : items.filter(activeCat.match);

  const counts: Record<string, number> = { all: items.length };
  for (const c of CATEGORIES) {
    if (c.key === "all" || !c.match) continue;
    counts[c.key] = items.filter(c.match).length;
  }

  return (
    <div className="fin">
      <div className="fin-hd">
        <div className="fin-hd-l">
          <div className="fin-hd-ico">📰</div>
          <div>
            <div className="fin-hd-tit">AI News</div>
            <div className="fin-hd-sub">
              Model releases, benchmarks, and research — sourced from Hacker News.
            </div>
          </div>
        </div>
        <button className="btn bp" onClick={refresh} disabled={pending}>
          {pending && <span className="fin-spinner" aria-hidden="true" />}
          {pending ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="fin-bar">
        <div className="news-meta">
          {fetchedAt ? `Last refreshed ${relTime(fetchedAt)}` : "Loading latest…"}
          {error && <span className="news-meta-err"> · {error}</span>}
        </div>
      </div>

      <div className="fin-chips">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            className={"fin-chip" + (cat === c.key ? " active" : "")}
            onClick={() => setCat(c.key)}
          >
            {c.label}
            <span className="fin-chip-cnt">{counts[c.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="fin-empty">
          <div className="fin-empty-ico">{pending ? "⏳" : "📰"}</div>
          <div className="fin-empty-tit">
            {pending ? "Fetching news…" : "No news yet"}
          </div>
          <div className="fin-empty-sub">
            {error
              ? "Could not reach the news source. Check your network and try Refresh."
              : "Try the Refresh button or pick a different filter."}
          </div>
        </div>
      ) : (
        <ul className="news-list">
          {visible.map((n) => (
            <li className="news-item" key={n.id}>
              <a className="news-link" href={n.url} target="_blank" rel="noopener noreferrer">
                {n.title}
              </a>
              <div className="news-meta-row">
                <span className="news-source">{n.source}</span>
                <span className="news-dot">·</span>
                <span>{relTime(n.publishedAt)}</span>
                <span className="news-dot">·</span>
                <span>▲ {n.points}</span>
                <span className="news-dot">·</span>
                <a
                  className="news-comments"
                  href={`https://news.ycombinator.com/item?id=${n.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {n.comments} comments
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

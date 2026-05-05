"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createQuoteAction,
  updateQuoteAction,
  deleteQuoteAction,
} from "./actions";

export type QuoteItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type Quote = {
  id: number;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: QuoteItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "accepted", label: "Accepted" },
  { key: "rejected", label: "Rejected" },
] as const;

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function emptyItem(): QuoteItem {
  return { description: "", quantity: 1, rate: 0, amount: 0 };
}

function calcTotals(items: QuoteItem[], taxPct: number) {
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export default function Quotes({ initialQuotes }: { initialQuotes: Quote[] }) {
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return quotes.filter((qt) => {
      if (statusFilter !== "all" && qt.status !== statusFilter) return false;
      if (!q) return true;
      return (
        qt.clientName.toLowerCase().includes(q) ||
        qt.clientEmail.toLowerCase().includes(q) ||
        qt.notes.toLowerCase().includes(q)
      );
    });
  }, [quotes, query, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = quotes.reduce((s, q) => s + q.total, 0);
    const accepted = quotes.filter((q) => q.status === "accepted");
    const acceptedValue = accepted.reduce((s, q) => s + q.total, 0);
    return {
      count: quotes.length,
      totalValue,
      accepted: accepted.length,
      acceptedValue,
    };
  }, [quotes]);

  const onCreate = (data: Omit<Quote, "id" | "createdAt" | "updatedAt" | "status">) => {
    startTransition(async () => {
      await createQuoteAction(data);
      // optimistic local insert
      setQuotes((prev) => [
        {
          ...data,
          id: -Date.now(),
          status: "draft",
          createdAt: "Just now",
          updatedAt: "Just now",
        },
        ...prev,
      ]);
    });
    setShowForm(false);
  };

  const onUpdate = (id: number, patch: Partial<Quote>) => {
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    startTransition(async () => {
      await updateQuoteAction({ id, ...patch });
    });
  };

  const onDelete = (id: number) => {
    if (!confirm("Delete this quote?")) return;
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    startTransition(async () => {
      await deleteQuoteAction({ id });
    });
  };

  const counts: Record<string, number> = { all: quotes.length };
  for (const s of ["draft", "sent", "accepted", "rejected"]) {
    counts[s] = quotes.filter((q) => q.status === s).length;
  }

  return (
    <div className="fin">
      <div className="fin-hd">
        <div className="fin-hd-l">
          <div className="fin-hd-ico">📝</div>
          <div>
            <div className="fin-hd-tit">Quotes</div>
            <div className="fin-hd-sub">
              Draft, send and track proposals to clients.
            </div>
          </div>
        </div>
        <button className="btn bp" onClick={() => setShowForm(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Quote</span>
        </button>
      </div>

      <div className="fin-stats">
        <div className="fin-stat">
          <div className="fin-stat-lbl">Total quotes</div>
          <div className="fin-stat-val">{stats.count}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Pipeline value</div>
          <div className="fin-stat-val">{fmt(stats.totalValue)}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Accepted</div>
          <div className="fin-stat-val">{stats.accepted}</div>
          <div className="fin-stat-sub">{fmt(stats.acceptedValue)}</div>
        </div>
      </div>

      <div className="fin-bar">
        <div className="fin-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by client, email or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="fin-chips">
        {STATUS.map((s) => (
          <button
            key={s.key}
            type="button"
            className={"fin-chip" + (statusFilter === s.key ? " active" : "")}
            onClick={() => setStatusFilter(s.key)}
          >
            {s.label}
            <span className="fin-chip-cnt">{counts[s.key] || 0}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="fin-empty">
          <div className="fin-empty-ico">{quotes.length === 0 ? "📝" : "🔍"}</div>
          <div className="fin-empty-tit">
            {quotes.length === 0 ? "No quotes yet" : "No matches"}
          </div>
          <div className="fin-empty-sub">
            {quotes.length === 0
              ? "Create your first quote to start tracking client proposals."
              : "Try a different search or status filter."}
          </div>
          {quotes.length === 0 && (
            <button className="fin-empty-btn" onClick={() => setShowForm(true)}>
              New Quote
            </button>
          )}
        </div>
      ) : (
        <div className="fin-grid">
          {filtered.map((q) => (
            <article className="fin-card" key={q.id}>
              <div className="fin-card-top">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="fin-card-id">Quote #{q.id > 0 ? q.id : "—"}</div>
                  <div className="fin-card-client">{q.clientName}</div>
                  <div className="fin-card-email">{q.clientEmail}</div>
                </div>
                <span className={"fin-pill " + q.status}>{q.status}</span>
              </div>

              <div className="fin-card-amt-wrap">
                <span className="fin-card-amt-lbl">Total</span>
                <span className="fin-card-amt">{fmt(q.total)}</span>
              </div>

              <div className="fin-card-foot">
                <span className="fin-card-meta">
                  {q.items.length} item{q.items.length === 1 ? "" : "s"} · {q.createdAt}
                </span>
                <div className="fin-card-acts">
                  <select
                    className="fin-status-sel"
                    value={q.status}
                    onChange={(e) => onUpdate(q.id, { status: e.target.value })}
                    aria-label="Quote status"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <button
                    className="fin-icon-btn"
                    onClick={() => setEditing(q)}
                    aria-label="Edit"
                    title="Edit"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    className="fin-icon-btn danger"
                    onClick={() => onDelete(q.id)}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <QuoteFormModal
          onSubmit={onCreate}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <QuoteFormModal
          initial={editing}
          onSubmit={(data) => {
            onUpdate(editing.id, data);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function QuoteFormModal({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Quote;
  onSubmit: (
    data: Omit<Quote, "id" | "createdAt" | "updatedAt" | "status">
  ) => void;
  onCancel: () => void;
}) {
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [clientAddress, setClientAddress] = useState(
    initial?.clientAddress ?? ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items?.length ? initial.items : [emptyItem()]
  );
  const [taxPct, setTaxPct] = useState<number>(() => {
    if (!initial || initial.subtotal === 0) return 0;
    return Math.round((initial.tax / initial.subtotal) * 100);
  });

  const totals = calcTotals(items, taxPct);

  const updateItem = (idx: number, patch: Partial<QuoteItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        next.amount = Math.round(next.quantity * next.rate);
        return next;
      })
    );
  };

  const addItem = () => setItems((p) => [...p, emptyItem()]);
  const removeItem = (idx: number) =>
    setItems((p) => (p.length > 1 ? p.filter((_, i) => i !== idx) : p));

  const submit = () => {
    if (!clientName.trim() || !clientEmail.trim()) return;
    onSubmit({
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim(),
      clientAddress: clientAddress.trim(),
      items: items.filter((it) => it.description.trim() !== ""),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      notes: notes.trim(),
    });
  };

  return (
    <div className="mo open" onClick={onCancel}>
      <div
        className="modal fin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="m-title">{initial ? "Edit Quote" : "New Quote"}</div>

        <div className="fin-form-sec">
          <div className="fin-form-sec-tit">Client</div>
          <div className="frow">
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Name</label>
              <input
                className="fi"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Email</label>
              <input
                className="fi"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="billing@acme.com"
                required
              />
            </div>
          </div>
          <div className="fg" style={{ marginTop: 10, marginBottom: 0 }}>
            <label className="fl">Address</label>
            <textarea
              className="ft"
              style={{ minHeight: 60 }}
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              placeholder="Street, City, ZIP"
            />
          </div>
        </div>

        <div className="fin-form-sec">
          <div className="fin-form-sec-tit">Line items</div>
          <div className="fin-items">
            <div className="fin-item-hd">
              <span>Description</span>
              <span>Qty</span>
              <span>Rate (¢)</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span />
            </div>
            {items.map((it, i) => (
              <div className="fin-item-row" key={i}>
                <input
                  className="fi"
                  value={it.description}
                  onChange={(e) =>
                    updateItem(i, { description: e.target.value })
                  }
                  placeholder="Service or product"
                />
                <input
                  className="fi"
                  type="number"
                  min={0}
                  value={it.quantity}
                  onChange={(e) =>
                    updateItem(i, { quantity: Number(e.target.value) || 0 })
                  }
                />
                <input
                  className="fi"
                  type="number"
                  min={0}
                  value={it.rate}
                  onChange={(e) =>
                    updateItem(i, { rate: Number(e.target.value) || 0 })
                  }
                />
                <div className="fin-item-amt">{fmt(it.amount)}</div>
                <button
                  type="button"
                  className="fin-item-del"
                  onClick={() => removeItem(i)}
                  aria-label="Remove item"
                  disabled={items.length === 1}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="fin-add-item" onClick={addItem}>
            + Add item
          </button>
        </div>

        <div className="fin-totals">
          <div className="fin-tot-row">
            <span className="fin-tot-lbl">Subtotal</span>
            <span className="fin-tot-val">{fmt(totals.subtotal)}</span>
          </div>
          <div className="fin-tot-row">
            <span className="fin-tot-lbl">Tax</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                className="fi fin-tax-input"
                type="number"
                min={0}
                max={100}
                value={taxPct}
                onChange={(e) => setTaxPct(Number(e.target.value) || 0)}
              />
              <span className="fin-tot-val" style={{ color: "var(--muted)" }}>
                % · {fmt(totals.tax)}
              </span>
            </span>
          </div>
          <div className="fin-tot-row total">
            <span>Total</span>
            <span>{fmt(totals.total)}</span>
          </div>
        </div>

        <div className="fin-form-sec" style={{ marginTop: 14, marginBottom: 0 }}>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Notes</label>
            <textarea
              className="ft"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional terms, validity, follow-ups…"
            />
          </div>
        </div>

        <div className="m-acts">
          <button type="button" className="btn bg" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn bp"
            onClick={submit}
            disabled={!clientName.trim() || !clientEmail.trim()}
          >
            {initial ? "Save changes" : "Create quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

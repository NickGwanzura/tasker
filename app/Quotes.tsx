"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createQuoteAction,
  updateQuoteAction,
  deleteQuoteAction,
  convertQuoteToInvoiceAction,
} from "./actions";
import { downloadQuotePdf, previewQuote } from "./quotePdf";
import type { CompanyInfo } from "./invoicePdf";

export type QuoteItem = {
  description: string;
  details?: string;
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
  return { description: "", details: "", quantity: 1, rate: 0, amount: 0 };
}

function calcTotals(items: QuoteItem[], taxPct: number) {
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export default function Quotes({
  initialQuotes,
  company,
}: {
  initialQuotes: Quote[];
  company: CompanyInfo;
}) {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>(initialQuotes);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topError, setTopError] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<number | null>(null);

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

  const onCreate = async (
    data: Omit<Quote, "id" | "createdAt" | "updatedAt" | "status">
  ) => {
    setTopError(null);
    const tempId = -Date.now();
    const optimistic: Quote = {
      ...data,
      id: tempId,
      status: "draft",
      createdAt: "Just now",
      updatedAt: "Just now",
    };
    setQuotes((prev) => [optimistic, ...prev]);
    if (statusFilter !== "all") setStatusFilter("all");
    try {
      const result = await createQuoteAction(data);
      if (result?.id) {
        setQuotes((prev) =>
          prev.map((q) =>
            q.id === tempId
              ? { ...optimistic, id: result.id!, status: result.status }
              : q
          )
        );
      }
    } catch (err) {
      console.error("createQuoteAction failed:", err);
      setQuotes((prev) => prev.filter((q) => q.id !== tempId));
      throw err;
    }
  };

  const onUpdate = async (id: number, patch: Partial<Quote>) => {
    const before = quotes.find((q) => q.id === id);
    setQuotes((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    try {
      const payload: Parameters<typeof updateQuoteAction>[0] = { id };
      if (patch.clientName !== undefined) payload.clientName = patch.clientName;
      if (patch.clientEmail !== undefined) payload.clientEmail = patch.clientEmail;
      if (patch.clientAddress !== undefined) payload.clientAddress = patch.clientAddress;
      if (patch.items !== undefined) payload.items = patch.items;
      if (patch.subtotal !== undefined) payload.subtotal = patch.subtotal;
      if (patch.tax !== undefined) payload.tax = patch.tax;
      if (patch.total !== undefined) payload.total = patch.total;
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.notes !== undefined) payload.notes = patch.notes;
      await updateQuoteAction(payload);
    } catch (err) {
      console.error("updateQuoteAction failed:", err);
      if (before) {
        setQuotes((prev) => prev.map((q) => (q.id === id ? before : q)));
      }
      throw err;
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this quote?")) return;
    setTopError(null);
    const before = quotes;
    setQuotes((prev) => prev.filter((q) => q.id !== id));
    try {
      await deleteQuoteAction({ id });
    } catch (err) {
      console.error("deleteQuoteAction failed:", err);
      setQuotes(before);
      setTopError("Could not delete quote.");
    }
  };

  const onConvertToInvoice = async (quote: Quote) => {
    if (quote.id <= 0 || convertingId !== null) return;
    setTopError(null);
    setConvertingId(quote.id);
    const before = quotes.find((q) => q.id === quote.id);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, status: "accepted" } : q))
    );
    try {
      await convertQuoteToInvoiceAction({ id: quote.id });
      router.refresh();
    } catch (err) {
      console.error("convertQuoteToInvoiceAction failed:", err);
      if (before) {
        setQuotes((prev) => prev.map((q) => (q.id === quote.id ? before : q)));
      }
      setTopError("Could not convert quote to invoice.");
    } finally {
      setConvertingId(null);
    }
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

      {topError && <div className="fin-form-error" style={{ marginBottom: 10 }}>{topError}</div>}

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
                    onClick={() => onConvertToInvoice(q)}
                    aria-label="Convert to invoice"
                    title="Convert to invoice"
                    disabled={q.id <= 0 || convertingId === q.id}
                  >
                    {convertingId === q.id ? (
                      <span className="fin-spinner" aria-hidden="true" />
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <path d="M8 13h7" />
                        <path d="m12 10 3 3-3 3" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="fin-icon-btn"
                    onClick={() => previewQuote(q, company)}
                    aria-label="Preview quote"
                    title="Preview quote"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  <button
                    className="fin-icon-btn"
                    onClick={() => downloadQuotePdf(q, company)}
                    aria-label="Download PDF"
                    title="Download PDF"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 18 15 15" />
                    </svg>
                  </button>
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
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <QuoteFormModal
          initial={editing}
          onSubmit={(data) => onUpdate(editing.id, data)}
          onSuccess={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function QuoteFormModal({
  initial,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  initial?: Quote;
  onSubmit: (
    data: Omit<Quote, "id" | "createdAt" | "updatedAt" | "status">
  ) => void | Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [clientAddress, setClientAddress] = useState(
    initial?.clientAddress ?? ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [items, setItems] = useState<QuoteItem[]>(
    initial?.items?.length ? initial.items.map((it) => ({ ...it, details: it.details ?? "" })) : [emptyItem()]
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

  const submit = async () => {
    if (pending) return;
    if (!clientName.trim() || !clientEmail.trim()) {
      setError("Fill in client name and email.");
      return;
    }
    const cleanItems = items.filter((it) => it.description.trim() !== "");
    if (cleanItems.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    const cleanTotals = calcTotals(cleanItems, taxPct);
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        items: cleanItems,
        subtotal: cleanTotals.subtotal,
        tax: cleanTotals.tax,
        total: cleanTotals.total,
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the quote. Please try again."
      );
      setPending(false);
    }
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
            <div className="fin-item-hd quote-item-hd">
              <span>Line item</span>
              <span>Qty</span>
              <span>Rate</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span />
            </div>
            {items.map((it, i) => (
              <div className="fin-item-row quote-item-row" key={i}>
                <div className="fin-item-desc">
                  <input
                    className="fi"
                    value={it.description}
                    onChange={(e) =>
                      updateItem(i, { description: e.target.value })
                    }
                    placeholder="Service or product"
                  />
                  <textarea
                    className="ft fin-item-details"
                    value={it.details ?? ""}
                    onChange={(e) => updateItem(i, { details: e.target.value })}
                    placeholder="Description"
                  />
                </div>
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
                  step={0.01}
                  value={it.rate / 100}
                  onChange={(e) =>
                    updateItem(i, { rate: Math.round(parseFloat(e.target.value || "0") * 100) })
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

        {error && <div className="fin-form-error">{error}</div>}

        <div className="m-acts">
          <button
            type="button"
            className="btn bg"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn bp"
            onClick={submit}
            disabled={pending}
          >
            {pending && <span className="fin-spinner" aria-hidden="true" />}
            {pending
              ? initial
                ? "Saving…"
                : "Creating…"
              : initial
              ? "Save changes"
              : "Create quote"}
          </button>
        </div>
      </div>
    </div>
  );
}

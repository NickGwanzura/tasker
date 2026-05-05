"use client";

import { useMemo, useState } from "react";
import {
  createInvoiceAction,
  updateInvoiceAction,
  deleteInvoiceAction,
} from "./actions";

export type InvoiceItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type Invoice = {
  id: number;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

const STATUS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
] as const;

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function dateOnly(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dateInputValue(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function isOverdue(inv: Invoice) {
  if (inv.status === "paid") return false;
  const d = new Date(inv.dueDate);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function emptyItem(): InvoiceItem {
  return { description: "", quantity: 1, rate: 0, amount: 0 };
}

function calcTotals(items: InvoiceItem[], taxPct: number) {
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const tax = Math.round((subtotal * taxPct) / 100);
  return { subtotal, tax, total: subtotal + tax };
}

export default function Invoices({
  initialInvoices,
}: {
  initialInvoices: Invoice[];
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      const effectiveStatus =
        inv.status === "unpaid" && isOverdue(inv) ? "overdue" : inv.status;
      if (statusFilter !== "all" && effectiveStatus !== statusFilter)
        return false;
      if (!q) return true;
      return (
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        inv.notes.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = invoices.reduce((s, i) => s + i.total, 0);
    const paid = invoices.filter((i) => i.status === "paid");
    const paidValue = paid.reduce((s, i) => s + i.total, 0);
    const outstanding = totalValue - paidValue;
    const overdue = invoices.filter(isOverdue).length;
    return {
      count: invoices.length,
      totalValue,
      outstanding,
      paid: paid.length,
      overdue,
    };
  }, [invoices]);

  const counts: Record<string, number> = { all: invoices.length };
  for (const s of ["unpaid", "paid", "overdue"]) {
    counts[s] = invoices.filter((i) => {
      if (s === "overdue") return isOverdue(i);
      if (s === "unpaid") return i.status === "unpaid" && !isOverdue(i);
      return i.status === s;
    }).length;
  }

  const onCreate = async (
    data: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "status">
  ) => {
    const tempId = -Date.now();
    const optimistic: Invoice = {
      ...data,
      id: tempId,
      status: "unpaid",
      createdAt: "Just now",
      updatedAt: "Just now",
    };
    setInvoices((prev) => [optimistic, ...prev]);
    if (statusFilter !== "all") setStatusFilter("all");
    try {
      const result = await createInvoiceAction({
        ...data,
        dueDate: new Date(data.dueDate),
      });
      if (result?.id) {
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === tempId
              ? { ...optimistic, id: result.id!, status: result.status }
              : i
          )
        );
      }
    } catch (err) {
      console.error("createInvoiceAction failed:", err);
      setInvoices((prev) => prev.filter((i) => i.id !== tempId));
      throw err;
    }
  };

  const onUpdate = async (id: number, patch: Partial<Invoice>) => {
    const before = invoices.find((i) => i.id === id);
    setInvoices((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
    try {
      const payload: Parameters<typeof updateInvoiceAction>[0] = { id };
      if (patch.clientName !== undefined) payload.clientName = patch.clientName;
      if (patch.clientEmail !== undefined) payload.clientEmail = patch.clientEmail;
      if (patch.clientAddress !== undefined)
        payload.clientAddress = patch.clientAddress;
      if (patch.items !== undefined) payload.items = patch.items;
      if (patch.subtotal !== undefined) payload.subtotal = patch.subtotal;
      if (patch.tax !== undefined) payload.tax = patch.tax;
      if (patch.total !== undefined) payload.total = patch.total;
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.notes !== undefined) payload.notes = patch.notes;
      if (patch.dueDate !== undefined) payload.dueDate = new Date(patch.dueDate);
      await updateInvoiceAction(payload);
    } catch (err) {
      console.error("updateInvoiceAction failed:", err);
      if (before) {
        setInvoices((prev) => prev.map((i) => (i.id === id ? before : i)));
      }
      throw err;
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this invoice?")) return;
    const before = invoices;
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteInvoiceAction({ id });
    } catch (err) {
      console.error("deleteInvoiceAction failed:", err);
      setInvoices(before);
      alert("Failed to delete invoice. Check the browser console.");
    }
  };

  return (
    <div className="fin">
      <div className="fin-hd">
        <div className="fin-hd-l">
          <div className="fin-hd-ico">🧾</div>
          <div>
            <div className="fin-hd-tit">Invoices</div>
            <div className="fin-hd-sub">
              Bill clients and track what's owed and what's paid.
            </div>
          </div>
        </div>
        <button className="btn bp" onClick={() => setShowForm(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Invoice</span>
        </button>
      </div>

      <div className="fin-stats">
        <div className="fin-stat">
          <div className="fin-stat-lbl">Total invoices</div>
          <div className="fin-stat-val">{stats.count}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Outstanding</div>
          <div className="fin-stat-val">{fmt(stats.outstanding)}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Paid</div>
          <div className="fin-stat-val">{stats.paid}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Overdue</div>
          <div className="fin-stat-val" style={stats.overdue > 0 ? { color: "var(--red)" } : undefined}>
            {stats.overdue}
          </div>
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
          <div className="fin-empty-ico">
            {invoices.length === 0 ? "🧾" : "🔍"}
          </div>
          <div className="fin-empty-tit">
            {invoices.length === 0 ? "No invoices yet" : "No matches"}
          </div>
          <div className="fin-empty-sub">
            {invoices.length === 0
              ? "Bill your first client by creating an invoice."
              : "Try a different search or status filter."}
          </div>
          {invoices.length === 0 && (
            <button className="fin-empty-btn" onClick={() => setShowForm(true)}>
              New Invoice
            </button>
          )}
        </div>
      ) : (
        <div className="fin-grid">
          {filtered.map((inv) => {
            const overdue = isOverdue(inv);
            const displayStatus = overdue ? "overdue" : inv.status;
            return (
              <article className="fin-card" key={inv.id}>
                <div className="fin-card-top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fin-card-id">
                      Invoice #{inv.id > 0 ? inv.id : "—"}
                    </div>
                    <div className="fin-card-client">{inv.clientName}</div>
                    <div className="fin-card-email">{inv.clientEmail}</div>
                  </div>
                  <span className={"fin-pill " + displayStatus}>
                    {displayStatus}
                  </span>
                </div>

                <div className="fin-card-amt-wrap">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span className="fin-card-amt-lbl">Total</span>
                    <span
                      className="fin-card-meta"
                      style={overdue ? { color: "var(--red)", fontWeight: 600 } : undefined}
                    >
                      Due {dateOnly(inv.dueDate)}
                    </span>
                  </div>
                  <span className="fin-card-amt">{fmt(inv.total)}</span>
                </div>

                <div className="fin-card-foot">
                  <span className="fin-card-meta">
                    {inv.items.length} item{inv.items.length === 1 ? "" : "s"} · {inv.createdAt}
                  </span>
                  <div className="fin-card-acts">
                    <select
                      className="fin-status-sel"
                      value={inv.status}
                      onChange={(e) => onUpdate(inv.id, { status: e.target.value })}
                      aria-label="Invoice status"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    <button
                      className="fin-icon-btn"
                      onClick={() => setEditing(inv)}
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
                      onClick={() => onDelete(inv.id)}
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
            );
          })}
        </div>
      )}

      {showForm && (
        <InvoiceFormModal
          onSubmit={onCreate}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <InvoiceFormModal
          initial={editing}
          onSubmit={(data) => onUpdate(editing.id, data)}
          onSuccess={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function InvoiceFormModal({
  initial,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  initial?: Invoice;
  onSubmit: (
    data: Omit<Invoice, "id" | "createdAt" | "updatedAt" | "status">
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
  const [dueDate, setDueDate] = useState(
    dateInputValue(initial?.dueDate ?? "") ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items?.length ? initial.items : [emptyItem()]
  );
  const [taxPct, setTaxPct] = useState<number>(() => {
    if (!initial || initial.subtotal === 0) return 0;
    return Math.round((initial.tax / initial.subtotal) * 100);
  });

  const totals = calcTotals(items, taxPct);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
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
    if (!clientName.trim() || !clientEmail.trim() || !dueDate) {
      setError("Fill in client name, email and due date.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        items: items.filter((it) => it.description.trim() !== ""),
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        dueDate: new Date(dueDate).toISOString(),
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the invoice. Please try again."
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
        <div className="m-title">{initial ? "Edit Invoice" : "New Invoice"}</div>

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
          <div className="frow" style={{ marginTop: 10 }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Address</label>
              <textarea
                className="ft"
                style={{ minHeight: 60 }}
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Street, City, ZIP"
              />
            </div>
            <div className="fg" style={{ marginBottom: 0, maxWidth: 180 }}>
              <label className="fl">Due date</label>
              <input
                className="fi"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
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
              placeholder="Payment instructions, terms…"
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
              : "Create invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

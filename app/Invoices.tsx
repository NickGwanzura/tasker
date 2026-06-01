"use client";

import { useMemo, useState } from "react";
import {
  createInvoiceAction,
  updateInvoiceAction,
  deleteInvoiceAction,
  createReceiptAction,
} from "./actions";
import { downloadInvoicePdf, type CompanyInfo } from "./invoicePdf";

export type InvoiceItem = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  discount?: number; // percentage 0–100
};

export type Invoice = {
  id: number;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // invoice-level discount in cents
  tax: number;
  total: number;
  paidAmount: number;
  status: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Receipt = {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  notes: string;
  createdAt: string;
};

const STATUS = [
  { key: "all", label: "All" },
  { key: "unpaid", label: "Unpaid" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
] as const;

const PAYMENT_METHODS = ["Bank Transfer", "Cash", "Card", "Check", "PayPal", "Stripe", "Other"];

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
  if (inv.status === "overdue") return true;
  const d = new Date(inv.dueDate);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

function daysOverdue(dueDate: string): number {
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function emptyItem(): InvoiceItem {
  return { description: "", quantity: 1, rate: 0, amount: 0, discount: 0 };
}

function calcTotals(items: InvoiceItem[], taxPct: number, invoiceDiscount = 0) {
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const afterDiscount = Math.max(0, subtotal - invoiceDiscount);
  const tax = Math.round((afterDiscount * taxPct) / 100);
  return { subtotal, tax, total: afterDiscount + tax };
}

export default function Invoices({
  initialInvoices,
  initialReceipts = [],
  company,
}: {
  initialInvoices: Invoice[];
  initialReceipts?: Receipt[];
  company: CompanyInfo;
}) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topError, setTopError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices.filter((inv) => {
      const effectiveStatus =
        (inv.status === "unpaid" || inv.status === "partial") && isOverdue(inv) ? "overdue" : inv.status;
      if (statusFilter !== "all" && effectiveStatus !== statusFilter)
        return false;
      if (!q) return true;
      return (
        inv.clientName.toLowerCase().includes(q) ||
        inv.clientEmail.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.notes.toLowerCase().includes(q)
      );
    });
  }, [invoices, query, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = invoices.reduce((s, i) => s + i.total, 0);
    const totalPaid = invoices.reduce((s, i) => s + i.paidAmount, 0);
    const outstanding = totalValue - totalPaid;
    const overdueInvs = invoices.filter(isOverdue);
    const overdue = overdueInvs.length;
    const overdueAmt = overdueInvs.reduce((s, i) => s + (i.total - i.paidAmount), 0);

    // Aging buckets for overdue invoices
    const aging = { d30: 0, d60: 0, d90plus: 0 };
    for (const inv of overdueInvs) {
      const days = daysOverdue(inv.dueDate);
      if (days <= 30) aging.d30++;
      else if (days <= 60) aging.d60++;
      else aging.d90plus++;
    }

    return { count: invoices.length, totalValue, totalPaid, outstanding, overdue, overdueAmt, aging };
  }, [invoices]);

  const counts: Record<string, number> = { all: invoices.length };
  for (const s of ["unpaid", "partial", "paid", "overdue"]) {
    counts[s] = invoices.filter((i) => {
      if (s === "overdue") return isOverdue(i);
      if (s === "unpaid") return i.status === "unpaid" && !isOverdue(i);
      if (s === "partial") return i.status === "partial" && !isOverdue(i);
      return i.status === s;
    }).length;
  }

  const onCreate = async (
    data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt" | "status" | "paidAmount">
  ) => {
    setTopError(null);
    const tempId = -Date.now();
    const optimistic: Invoice = {
      ...data,
      paidAmount: 0,
      id: tempId,
      invoiceNumber: "…",
      status: "unpaid",
      createdAt: "Just now",
      updatedAt: "Just now",
    };
    setInvoices((prev) => [optimistic, ...prev]);
    if (statusFilter !== "all") setStatusFilter("all");
    try {
      const result = await createInvoiceAction({ ...data, dueDate: data.dueDate });
      if (result?.id) {
        setInvoices((prev) =>
          prev.map((i) =>
            i.id === tempId
              ? { ...optimistic, id: result.id!, status: result.status, invoiceNumber: result.invoiceNumber ?? "" }
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
      if (patch.clientAddress !== undefined) payload.clientAddress = patch.clientAddress;
      if (patch.items !== undefined) payload.items = patch.items;
      if (patch.subtotal !== undefined) payload.subtotal = patch.subtotal;
      if (patch.discount !== undefined) payload.discount = patch.discount;
      if (patch.tax !== undefined) payload.tax = patch.tax;
      if (patch.total !== undefined) payload.total = patch.total;
      if (patch.paidAmount !== undefined) payload.paidAmount = patch.paidAmount;
      if (patch.status !== undefined) payload.status = patch.status;
      if (patch.notes !== undefined) payload.notes = patch.notes;
      if (patch.dueDate !== undefined) payload.dueDate = patch.dueDate;
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
    setTopError(null);
    const before = invoices;
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    try {
      await deleteInvoiceAction({ id });
    } catch (err) {
      console.error("deleteInvoiceAction failed:", err);
      setInvoices(before);
      setTopError("Could not delete invoice.");
    }
  };

  const onRecordPayment = async (invoiceId: number, amount: number, paymentMethod: string) => {
    const before = invoices.find((i) => i.id === invoiceId);
    setInvoices((prev) =>
      prev.map((i) => {
        if (i.id !== invoiceId) return i;
        const newPaid = i.paidAmount + amount;
        const newStatus = newPaid >= i.total ? "paid" : "partial";
        return { ...i, paidAmount: newPaid, status: newStatus };
      })
    );
    try {
      const result = await createReceiptAction({
        invoiceId,
        amount,
        paymentMethod,
        transactionId: "",
        notes: "",
      });
      if (result?.id) {
        setReceipts((prev) => [
          {
            id: result.id!,
            invoiceId,
            amount,
            paymentMethod,
            transactionId: "",
            notes: "",
            createdAt: "Just now",
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error("createReceiptAction failed:", err);
      if (before) {
        setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? before : i)));
      }
      throw err;
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
              Bill clients and track what&apos;s owed and what&apos;s paid.
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
          <div className="fin-stat-lbl">Collected</div>
          <div className="fin-stat-val">{fmt(stats.totalPaid)}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Overdue</div>
          <div className="fin-stat-val" style={stats.overdue > 0 ? { color: "var(--red)" } : undefined}>
            {stats.overdue}
          </div>
          {stats.overdue > 0 && (
            <div style={{ fontSize: 11, color: "var(--red)", marginTop: 2, opacity: 0.8 }}>
              {fmt(stats.overdueAmt)}
            </div>
          )}
        </div>
      </div>

      {stats.overdue > 0 && (
        <div className="fin-overdue-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {stats.overdue} overdue invoice{stats.overdue !== 1 ? "s" : ""} totalling {fmt(stats.overdueAmt)}
            {stats.aging.d90plus > 0 && ` · ${stats.aging.d90plus} past 90 days`}
          </span>
          <button
            type="button"
            className="fin-overdue-filter"
            onClick={() => setStatusFilter("overdue")}
          >
            View
          </button>
        </div>
      )}

      <div className="fin-bar">
        <div className="fin-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search by client, email, invoice number…"
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
            const remaining = inv.total - inv.paidAmount;
            const pctPaid = inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0;
            const needsPayment = inv.status !== "paid" && remaining > 0;
            const days = overdue ? daysOverdue(inv.dueDate) : 0;
            return (
              <article className="fin-card" key={inv.id}>
                <div className="fin-card-top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fin-card-id">
                      {inv.invoiceNumber || `#${inv.id > 0 ? inv.id : "—"}`}
                    </div>
                    <div className="fin-card-client">{inv.clientName}</div>
                    <div className="fin-card-email">{inv.clientEmail}</div>
                  </div>
                  <span className={"fin-pill " + displayStatus}>
                    {displayStatus}
                  </span>
                </div>

                <div className="fin-card-amt-wrap" style={{ flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", width: "100%" }}>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span className="fin-card-amt-lbl">Total</span>
                      <span
                        className="fin-card-meta"
                        style={overdue ? { color: "var(--red)", fontWeight: 600 } : undefined}
                      >
                        Due {dateOnly(inv.dueDate)}
                        {overdue && days > 0 && ` · ${days}d overdue`}
                      </span>
                    </div>
                    <span className="fin-card-amt">{fmt(inv.total)}</span>
                  </div>

                  {inv.paidAmount > 0 && (
                    <div style={{ width: "100%" }}>
                      <div className="fin-pbar">
                        <div className="fin-pbar-fill" style={{ width: pctPaid + "%" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--muted)", marginTop: 3 }}>
                        <span>Paid: {fmt(inv.paidAmount)} ({pctPaid}%)</span>
                        {remaining > 0 && <span>Remaining: {fmt(remaining)}</span>}
                      </div>
                    </div>
                  )}
                </div>

                <div className="fin-card-foot">
                  <span className="fin-card-meta">
                    {inv.items.length} item{inv.items.length === 1 ? "" : "s"} · {inv.createdAt}
                  </span>
                  <div className="fin-card-acts">
                    {needsPayment && (
                      <button
                        className="fin-pay-btn"
                        onClick={() => setPayingInvoice(inv)}
                        aria-label="Record payment"
                        title="Record payment"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v20M2 12h20" />
                        </svg>
                      </button>
                    )}
                    <select
                      className="fin-status-sel"
                      value={inv.status}
                      onChange={(e) => onUpdate(inv.id, { status: e.target.value })}
                      aria-label="Invoice status"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                    <button
                      className="fin-icon-btn"
                      onClick={() => downloadInvoicePdf(inv, company)}
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
      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          receipts={receipts.filter((r) => r.invoiceId === payingInvoice.id)}
          onSubmit={onRecordPayment}
          onCancel={() => setPayingInvoice(null)}
        />
      )}
    </div>
  );
}

function PaymentModal({
  invoice,
  receipts,
  onSubmit,
  onCancel,
}: {
  invoice: Invoice;
  receipts: Receipt[];
  onSubmit: (invoiceId: number, amount: number, paymentMethod: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remaining = invoice.total - invoice.paidAmount;
  const [amount, setAmount] = useState(remaining);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);

  const submit = async () => {
    if (pending) return;
    if (amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (amount > remaining) {
      setError(`Amount cannot exceed the remaining balance of ${fmt(remaining)}.`);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit(invoice.id, amount, paymentMethod);
      onCancel();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not record payment. Please try again."
      );
      setPending(false);
    }
  };

  return (
    <div className="mo open" onClick={onCancel}>
      <div className="modal fin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
        <div className="m-title">Record Payment</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            {invoice.invoiceNumber || `#${invoice.id}`} — {invoice.clientName}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>Total: <strong>{fmt(invoice.total)}</strong></span>
            <span>Paid: <strong>{fmt(invoice.paidAmount)}</strong></span>
            <span>Remaining: <strong style={{ color: "var(--accent)" }}>{fmt(remaining)}</strong></span>
          </div>
        </div>

        {receipts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)", marginBottom: 6 }}>
              Payment history
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              {receipts.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600 }}>{fmt(r.amount)}</span>
                    <span style={{ color: "var(--muted)", marginLeft: 8 }}>{r.paymentMethod}</span>
                  </div>
                  <span style={{ color: "var(--muted)" }}>{r.createdAt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="fg" style={{ marginBottom: 12 }}>
          <label className="fl">Payment amount</label>
          <div style={{ position: "relative" }}>
            <span style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              fontWeight: 600,
              fontSize: 14,
              pointerEvents: "none",
            }}>$</span>
            <input
              className="fi"
              type="number"
              min={1}
              max={remaining}
              step={0.01}
              value={amount / 100}
              onChange={(e) => setAmount(Math.round(parseFloat(e.target.value || "0") * 100))}
              style={{ paddingLeft: 26, fontSize: 16, fontWeight: 700, height: 42 }}
              onFocus={(e) => e.target.select()}
            />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {[0.25, 0.5, 0.75, 1].map((frac) => (
              <button
                key={frac}
                type="button"
                className="fin-pay-frac"
                onClick={() => setAmount(Math.round(remaining * frac))}
              >
                {Math.round(frac * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div className="fg" style={{ marginBottom: 12 }}>
          <label className="fl">Payment method</label>
          <select
            className="fi"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {error && <div className="fin-form-error">{error}</div>}

        <div className="m-acts">
          <button type="button" className="btn bg" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn bp" onClick={submit} disabled={pending}>
            {pending && <span className="fin-spinner" aria-hidden="true" />}
            {pending ? "Recording…" : `Record ${fmt(amount)}`}
          </button>
        </div>
      </div>
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
    data: Omit<Invoice, "id" | "invoiceNumber" | "createdAt" | "updatedAt" | "status" | "paidAmount">
  ) => void | Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientName, setClientName] = useState(initial?.clientName ?? "");
  const [clientEmail, setClientEmail] = useState(initial?.clientEmail ?? "");
  const [clientAddress, setClientAddress] = useState(initial?.clientAddress ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueDate, setDueDate] = useState(
    dateInputValue(initial?.dueDate ?? "") ||
      new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [items, setItems] = useState<InvoiceItem[]>(
    initial?.items?.length ? initial.items.map((it) => ({ ...it, discount: it.discount ?? 0 })) : [emptyItem()]
  );
  const [taxPct, setTaxPct] = useState<number>(() => {
    if (!initial || initial.subtotal === 0) return 0;
    return Math.round((initial.tax / initial.subtotal) * 100);
  });
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(initial?.discount ?? 0);

  const totals = calcTotals(items, taxPct, invoiceDiscount);

  const updateItem = (idx: number, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        const base = Math.round(next.quantity * next.rate);
        const itemDisc = next.discount ? Math.round(base * next.discount / 100) : 0;
        next.amount = Math.max(0, base - itemDisc);
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
    const cleanItems = items.filter((it) => it.description.trim() !== "");
    if (cleanItems.length === 0) {
      setError("Add at least one line item.");
      return;
    }
    const cleanTotals = calcTotals(cleanItems, taxPct, invoiceDiscount);
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientAddress: clientAddress.trim(),
        items: cleanItems,
        subtotal: cleanTotals.subtotal,
        discount: invoiceDiscount,
        tax: cleanTotals.tax,
        total: cleanTotals.total,
        dueDate,
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
            <div className="fin-item-hd" style={{ gridTemplateColumns: "1fr 60px 90px 60px 90px 28px" }}>
              <span>Description</span>
              <span>Qty</span>
              <span>Rate (¢)</span>
              <span>Disc.%</span>
              <span style={{ textAlign: "right" }}>Amount</span>
              <span />
            </div>
            {items.map((it, i) => (
              <div className="fin-item-row" key={i} style={{ gridTemplateColumns: "1fr 60px 90px 60px 90px 28px" }}>
                <input
                  className="fi"
                  value={it.description}
                  onChange={(e) => updateItem(i, { description: e.target.value })}
                  placeholder="Service or product"
                />
                <input
                  className="fi"
                  type="number"
                  min={0}
                  value={it.quantity}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 0 })}
                />
                <input
                  className="fi"
                  type="number"
                  min={0}
                  value={it.rate}
                  onChange={(e) => updateItem(i, { rate: Number(e.target.value) || 0 })}
                />
                <input
                  className="fi"
                  type="number"
                  min={0}
                  max={100}
                  value={it.discount ?? 0}
                  onChange={(e) => updateItem(i, { discount: Number(e.target.value) || 0 })}
                  placeholder="0"
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
            <span className="fin-tot-lbl">Discount</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>$</span>
              <input
                className="fi fin-tax-input"
                type="number"
                min={0}
                value={invoiceDiscount / 100}
                onChange={(e) => setInvoiceDiscount(Math.round(parseFloat(e.target.value || "0") * 100))}
                placeholder="0"
              />
              {invoiceDiscount > 0 && (
                <span className="fin-tot-val" style={{ color: "var(--muted)" }}>
                  − {fmt(invoiceDiscount)}
                </span>
              )}
            </span>
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

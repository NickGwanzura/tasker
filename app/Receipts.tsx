"use client";

import { useMemo, useState } from "react";
import {
  createReceiptAction,
  deleteReceiptAction,
} from "./actions";
import type { Invoice } from "./Invoices";
import { downloadReceiptPdf, previewReceipt } from "./receiptPdf";
import type { CompanyInfo } from "./invoicePdf";

export type Receipt = {
  id: number;
  invoiceId: number;
  amount: number;
  paymentMethod: string;
  transactionId: string;
  notes: string;
  createdAt: string;
};

const PAYMENT_METHODS = [
  "Bank transfer",
  "Credit card",
  "Cash",
  "Check",
  "PayPal",
  "Stripe",
  "Other",
];

function fmt(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function Receipts({
  initialReceipts,
  invoices,
  company,
}: {
  initialReceipts: Receipt[];
  invoices: Invoice[];
  company: CompanyInfo;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [topError, setTopError] = useState<string | null>(null);

  const invoiceMap = useMemo(() => {
    const m = new Map<number, Invoice>();
    for (const i of invoices) m.set(i.id, i);
    return m;
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return receipts.filter((r) => {
      if (methodFilter !== "all" && r.paymentMethod !== methodFilter)
        return false;
      if (!q) return true;
      const inv = invoiceMap.get(r.invoiceId);
      const clientName = inv?.clientName.toLowerCase() ?? "";
      return (
        r.transactionId.toLowerCase().includes(q) ||
        r.paymentMethod.toLowerCase().includes(q) ||
        r.notes.toLowerCase().includes(q) ||
        clientName.includes(q) ||
        String(r.invoiceId).includes(q)
      );
    });
  }, [receipts, query, methodFilter, invoiceMap]);

  const stats = useMemo(() => {
    const totalCollected = receipts.reduce((s, r) => s + r.amount, 0);
    const methods = new Set(receipts.map((r) => r.paymentMethod));
    return {
      count: receipts.length,
      totalCollected,
      methodCount: methods.size,
    };
  }, [receipts]);

  const methodChips = useMemo(() => {
    const present = new Set(receipts.map((r) => r.paymentMethod));
    return ["all", ...PAYMENT_METHODS.filter((m) => present.has(m))];
  }, [receipts]);

  const counts: Record<string, number> = { all: receipts.length };
  for (const m of PAYMENT_METHODS) {
    counts[m] = receipts.filter((r) => r.paymentMethod === m).length;
  }

  const onCreate = async (data: Omit<Receipt, "id" | "createdAt">) => {
    setTopError(null);
    const tempId = -Date.now();
    const optimistic: Receipt = { ...data, id: tempId, createdAt: "Just now" };
    setReceipts((prev) => [optimistic, ...prev]);
    if (methodFilter !== "all" && methodFilter !== data.paymentMethod) {
      setMethodFilter("all");
    }
    try {
      const result = await createReceiptAction(data);
      if (result?.id) {
        setReceipts((prev) =>
          prev.map((r) =>
            r.id === tempId ? { ...optimistic, id: result.id! } : r
          )
        );
      }
    } catch (err) {
      console.error("createReceiptAction failed:", err);
      setReceipts((prev) => prev.filter((r) => r.id !== tempId));
      throw err;
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this receipt?")) return;
    setTopError(null);
    const before = receipts;
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteReceiptAction({ id });
    } catch (err) {
      console.error("deleteReceiptAction failed:", err);
      setReceipts(before);
      setTopError("Could not delete receipt.");
    }
  };

  return (
    <div className="fin">
      <div className="fin-hd">
        <div className="fin-hd-l">
          <div className="fin-hd-ico">🧷</div>
          <div>
            <div className="fin-hd-tit">Receipts</div>
            <div className="fin-hd-sub">
              Payment records linked to invoices.
            </div>
          </div>
        </div>
        <button
          className="btn bp"
          onClick={() => setShowForm(true)}
          disabled={invoices.length === 0}
          title={invoices.length === 0 ? "Create an invoice first" : ""}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Receipt</span>
        </button>
      </div>

      <div className="fin-stats">
        <div className="fin-stat">
          <div className="fin-stat-lbl">Total receipts</div>
          <div className="fin-stat-val">{stats.count}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Collected</div>
          <div className="fin-stat-val">{fmt(stats.totalCollected)}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Payment methods</div>
          <div className="fin-stat-val">{stats.methodCount}</div>
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
            placeholder="Search by client, invoice, transaction or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {topError && <div className="fin-form-error" style={{ marginBottom: 10 }}>{topError}</div>}

      {methodChips.length > 1 && (
        <div className="fin-chips">
          {methodChips.map((m) => (
            <button
              key={m}
              type="button"
              className={"fin-chip" + (methodFilter === m ? " active" : "")}
              onClick={() => setMethodFilter(m)}
            >
              {m === "all" ? "All methods" : m}
              <span className="fin-chip-cnt">
                {m === "all" ? receipts.length : counts[m] || 0}
              </span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="fin-empty">
          <div className="fin-empty-ico">
            {receipts.length === 0 ? "🧷" : "🔍"}
          </div>
          <div className="fin-empty-tit">
            {receipts.length === 0 ? "No receipts yet" : "No matches"}
          </div>
          <div className="fin-empty-sub">
            {receipts.length === 0
              ? invoices.length === 0
                ? "Receipts attach to invoices — create an invoice first."
                : "Record a payment against an invoice to start tracking receipts."
              : "Try a different search or method filter."}
          </div>
          {receipts.length === 0 && invoices.length > 0 && (
            <button className="fin-empty-btn" onClick={() => setShowForm(true)}>
              New Receipt
            </button>
          )}
        </div>
      ) : (
        <div className="fin-grid">
          {filtered.map((r) => {
            const inv = invoiceMap.get(r.invoiceId);
            return (
              <article className="fin-card" key={r.id}>
                <div className="fin-card-top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fin-card-id">
                      Receipt #{r.id > 0 ? r.id : "—"}
                    </div>
                    <div className="fin-card-client">
                      {inv ? inv.clientName : `Invoice #${r.invoiceId}`}
                    </div>
                    <div className="fin-card-email">
                      {inv ? `Invoice #${r.invoiceId} · ${inv.clientEmail}` : "Invoice removed"}
                    </div>
                  </div>
                  <span className="fin-pill paid">{r.paymentMethod}</span>
                </div>

                <div className="fin-card-amt-wrap">
                  <span className="fin-card-amt-lbl">Amount</span>
                  <span className="fin-card-amt">{fmt(r.amount)}</span>
                </div>

                {(r.transactionId || r.notes) && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {r.transactionId && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        <span style={{ fontWeight: 600 }}>Txn:</span>{" "}
                        <span style={{ fontFamily: "monospace" }}>{r.transactionId}</span>
                      </div>
                    )}
                    {r.notes && (
                      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
                        {r.notes}
                      </div>
                    )}
                  </div>
                )}

                <div className="fin-card-foot">
                  <span className="fin-card-meta">{r.createdAt}</span>
                  <div className="fin-card-acts">
                    <button
                      className="fin-icon-btn"
                      onClick={() => previewReceipt(r, inv, company)}
                      aria-label="Preview receipt"
                      title="Preview receipt"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    <button
                      className="fin-icon-btn"
                      onClick={() => downloadReceiptPdf(r, inv, company)}
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
                      className="fin-icon-btn danger"
                      onClick={() => onDelete(r.id)}
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
        <ReceiptFormModal
          invoices={invoices}
          onSubmit={onCreate}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

function ReceiptFormModal({
  invoices,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  invoices: Invoice[];
  onSubmit: (data: Omit<Receipt, "id" | "createdAt">) => void | Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unpaid = invoices.filter((i) => i.status !== "paid");
  const list = unpaid.length > 0 ? unpaid : invoices;
  const [invoiceId, setInvoiceId] = useState<number>(list[0]?.id ?? 0);
  const selected = invoices.find((i) => i.id === invoiceId);
  const [amount, setAmount] = useState<number>(selected ? selected.total - (selected.paidAmount || 0) : 0);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");

  const onPickInvoice = (id: number) => {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (inv) setAmount(inv.total - (inv.paidAmount || 0));
  };

  const submit = async () => {
    if (pending) return;
    if (!invoiceId || amount <= 0 || !paymentMethod) {
      setError("Pick an invoice, enter an amount, and choose a method.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        invoiceId,
        amount: Math.round(amount),
        paymentMethod,
        transactionId: transactionId.trim(),
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the receipt. Please try again."
      );
      setPending(false);
    }
  };

  return (
    <div className="mo open" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-title">New Receipt</div>

        <div className="fg">
          <label className="fl">Invoice</label>
          <select
            className="fs"
            value={invoiceId}
            onChange={(e) => onPickInvoice(Number(e.target.value))}
          >
            {list.length === 0 ? (
              <option value={0}>No invoices available</option>
            ) : (
              list.map((i) => (
                <option key={i.id} value={i.id}>
                  #{i.id} · {i.clientName} · {fmt(i.total)} ({i.status})
                </option>
              ))
            )}
          </select>
        </div>

        <div className="frow">
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Amount</label>
            <input
              className="fi"
              type="number"
              min={0}
              step={0.01}
              value={amount / 100}
              onChange={(e) => setAmount(Math.round(parseFloat(e.target.value || "0") * 100))}
            />
            {selected && (
              <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 4, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span>Total: {fmt(selected.total)}</span>
                {selected.paidAmount > 0 && <span>· Paid: {fmt(selected.paidAmount)}</span>}
                <span>· Remaining: <strong>{fmt(selected.total - (selected.paidAmount || 0))}</strong></span>
                {amount !== selected.total - (selected.paidAmount || 0) && (
                  <button
                    type="button"
                    onClick={() => setAmount(selected.total - (selected.paidAmount || 0))}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      cursor: "pointer",
                      fontSize: 11,
                      padding: 0,
                      fontWeight: 600,
                    }}
                  >
                    Use remaining
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="fg" style={{ marginBottom: 0 }}>
            <label className="fl">Payment method</label>
            <select
              className="fs"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="fg" style={{ marginTop: 13 }}>
          <label className="fl">Transaction ID</label>
          <input
            className="fi"
            value={transactionId}
            onChange={(e) => setTransactionId(e.target.value)}
            placeholder="Optional reference (e.g. ch_3Pq4...)"
          />
        </div>

        <div className="fg">
          <label className="fl">Notes</label>
          <textarea
            className="ft"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context…"
          />
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
            {pending ? "Recording…" : `Record ${fmt(amount)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

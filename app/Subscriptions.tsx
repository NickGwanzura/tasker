"use client";

import { useMemo, useState } from "react";
import {
  createSubscriptionAction,
  recordSubscriptionPaymentAction,
  updateSubscriptionAction,
  deleteSubscriptionAction,
} from "./actions";

export type Subscription = {
  id: number;
  name: string;
  vendor: string;
  amount: number;
  currency: string;
  cycleDays: number;
  lastPaidAt: string;
  expiresAt: string;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SubscriptionPayment = {
  id: number;
  subscriptionId: number;
  paidAt: string;
  amount: number;
  notes: string;
  createdAt: string;
};

const WARN_THRESHOLD_DAYS = 9;
const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "warning", label: "Renewal soon" },
  { key: "expired", label: "Expired" },
  { key: "paused", label: "Paused" },
] as const;

function fmtMoney(cents: number, currency = "USD") {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency });
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function dateInputValue(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

type Status = "active" | "warning" | "expired" | "paused";

function statusOf(sub: Subscription): { status: Status; daysLeft: number } {
  const now = new Date();
  const exp = new Date(sub.expiresAt);
  const daysLeft = isNaN(exp.getTime()) ? 0 : daysBetween(exp, now);
  if (!sub.active) return { status: "paused", daysLeft };
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= WARN_THRESHOLD_DAYS) return { status: "warning", daysLeft };
  return { status: "active", daysLeft };
}

function monthlyValueOf(sub: Subscription): number {
  if (!sub.active || sub.cycleDays <= 0) return 0;
  return Math.round((sub.amount * 30) / sub.cycleDays);
}

export default function Subscriptions({
  initialSubscriptions,
  initialPayments,
}: {
  initialSubscriptions: Subscription[];
  initialPayments: SubscriptionPayment[];
}) {
  const [subs, setSubs] = useState<Subscription[]>(initialSubscriptions);
  const [payments, setPayments] = useState<SubscriptionPayment[]>(initialPayments);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [paying, setPaying] = useState<Subscription | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [topError, setTopError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);

  const decorated = useMemo(
    () => subs.map((s) => ({ sub: s, ...statusOf(s), monthly: monthlyValueOf(s) })),
    [subs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return decorated.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (!q) return true;
      const s = d.sub;
      return (
        s.name.toLowerCase().includes(q) ||
        s.vendor.toLowerCase().includes(q) ||
        s.notes.toLowerCase().includes(q)
      );
    });
  }, [decorated, query, statusFilter]);

  const stats = useMemo(() => {
    const monthlyTotal = decorated.reduce((sum, d) => sum + d.monthly, 0);
    const active = decorated.filter((d) => d.status === "active").length;
    const warning = decorated.filter((d) => d.status === "warning").length;
    const expired = decorated.filter((d) => d.status === "expired").length;
    return {
      count: subs.length,
      monthlyTotal,
      annualTotal: monthlyTotal * 12,
      active,
      warning,
      expired,
    };
  }, [decorated, subs.length]);

  const counts: Record<string, number> = { all: decorated.length };
  for (const f of ["active", "warning", "expired", "paused"]) {
    counts[f] = decorated.filter((d) => d.status === f).length;
  }

  const renewalHints = useMemo(
    () => decorated.filter((d) => d.status === "warning" || d.status === "expired"),
    [decorated]
  );

  const onCreate = async (data: {
    name: string;
    vendor: string;
    amount: number;
    currency: string;
    cycleDays: number;
    lastPaidAt: string;
    notes: string;
  }) => {
    setTopError(null);
    const tempId = -Date.now();
    const paid = new Date(data.lastPaidAt);
    const expires = new Date(paid.getTime() + data.cycleDays * 24 * 60 * 60 * 1000);
    const optimistic: Subscription = {
      id: tempId,
      name: data.name,
      vendor: data.vendor,
      amount: data.amount,
      currency: data.currency,
      cycleDays: data.cycleDays,
      lastPaidAt: paid.toISOString(),
      expiresAt: expires.toISOString(),
      active: true,
      notes: data.notes,
      createdAt: paid.toISOString(),
      updatedAt: paid.toISOString(),
    };
    setSubs((prev) => [...prev, optimistic]);
    try {
      const result = await createSubscriptionAction(data);
      if (result?.id) {
        setSubs((prev) =>
          prev.map((s) =>
            s.id === tempId
              ? { ...optimistic, id: result.id!, expiresAt: result.expiresAt ?? optimistic.expiresAt }
              : s
          )
        );
      }
    } catch (err) {
      setSubs((prev) => prev.filter((s) => s.id !== tempId));
      throw err;
    }
  };

  const onUpdate = async (id: number, patch: Partial<Subscription>) => {
    const before = subs.find((s) => s.id === id);
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    try {
      const payload: Parameters<typeof updateSubscriptionAction>[0] = { id };
      if (patch.name !== undefined) payload.name = patch.name;
      if (patch.vendor !== undefined) payload.vendor = patch.vendor;
      if (patch.amount !== undefined) payload.amount = patch.amount;
      if (patch.currency !== undefined) payload.currency = patch.currency;
      if (patch.cycleDays !== undefined) payload.cycleDays = patch.cycleDays;
      if (patch.active !== undefined) payload.active = patch.active;
      if (patch.notes !== undefined) payload.notes = patch.notes;
      await updateSubscriptionAction(payload);
    } catch (err) {
      if (before) setSubs((prev) => prev.map((s) => (s.id === id ? before : s)));
      throw err;
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("Delete this subscription and all its payment history?")) return;
    setTopError(null);
    const beforeSubs = subs;
    const beforePays = payments;
    setSubs((prev) => prev.filter((s) => s.id !== id));
    setPayments((prev) => prev.filter((p) => p.subscriptionId !== id));
    try {
      await deleteSubscriptionAction({ id });
    } catch (err) {
      console.error(err);
      setSubs(beforeSubs);
      setPayments(beforePays);
      setTopError("Could not delete subscription.");
    }
  };

  const onRecordPayment = async (
    sub: Subscription,
    data: { paidAt: string; amount: number; notes: string }
  ) => {
    setTopError(null);
    const paid = new Date(data.paidAt);
    const newExpires = new Date(paid.getTime() + sub.cycleDays * 24 * 60 * 60 * 1000);
    const tempPayment: SubscriptionPayment = {
      id: -Date.now(),
      subscriptionId: sub.id,
      paidAt: paid.toISOString(),
      amount: data.amount,
      notes: data.notes,
      createdAt: paid.toISOString(),
    };
    const beforeSubs = subs;
    const beforePays = payments;
    setPayments((prev) => [tempPayment, ...prev]);
    setSubs((prev) =>
      prev.map((s) =>
        s.id === sub.id
          ? { ...s, lastPaidAt: paid.toISOString(), expiresAt: newExpires.toISOString() }
          : s
      )
    );
    try {
      await recordSubscriptionPaymentAction({
        subscriptionId: sub.id,
        paidAt: data.paidAt,
        amount: data.amount,
        notes: data.notes,
      });
    } catch (err) {
      setSubs(beforeSubs);
      setPayments(beforePays);
      throw err;
    }
  };

  return (
    <div className="fin">
      <div className="fin-hd">
        <div className="fin-hd-l">
          <div className="fin-hd-ico">🔁</div>
          <div>
            <div className="fin-hd-tit">Subscription Tracker</div>
            <div className="fin-hd-sub">
              Log billings, watch the 30-day cycle, and see total monthly burn.
            </div>
          </div>
        </div>
        <button className="btn bp" onClick={() => setShowForm(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New Subscription</span>
        </button>
      </div>

      <div className="fin-stats">
        <div className="fin-stat">
          <div className="fin-stat-lbl">Monthly value</div>
          <div className="fin-stat-val">{fmtMoney(stats.monthlyTotal)}</div>
          <div className="fin-stat-sub">≈ {fmtMoney(stats.annualTotal)} / yr</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Active</div>
          <div className="fin-stat-val">{stats.active}</div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Renewal soon</div>
          <div
            className="fin-stat-val"
            style={stats.warning > 0 ? { color: "var(--yellow)" } : undefined}
          >
            {stats.warning}
          </div>
        </div>
        <div className="fin-stat">
          <div className="fin-stat-lbl">Expired</div>
          <div
            className="fin-stat-val"
            style={stats.expired > 0 ? { color: "var(--red)" } : undefined}
          >
            {stats.expired}
          </div>
        </div>
      </div>

      {renewalHints.length > 0 && (
        <div className="sub-hints">
          {renewalHints.map((d) => {
            const phrase =
              d.status === "expired"
                ? `expired ${Math.abs(d.daysLeft)}d ago`
                : d.daysLeft === 0
                ? "renews today"
                : `renews in ${d.daysLeft}d`;
            return (
              <div
                key={d.sub.id}
                className={"sub-hint " + d.status}
                onClick={() => setPaying(d.sub)}
                role="button"
                tabIndex={0}
              >
                <span className="sub-hint-ico">
                  {d.status === "expired" ? "⛔" : "⏰"}
                </span>
                <span className="sub-hint-name">{d.sub.name}</span>
                <span className="sub-hint-meta">{phrase}</span>
                <span className="sub-hint-cta">Log payment →</span>
              </div>
            );
          })}
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
            placeholder="Search by name, vendor or notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {topError && <div className="fin-form-error" style={{ marginBottom: 10 }}>{topError}</div>}

      <div className="fin-chips">
        {STATUS_FILTERS.map((s) => (
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
          <div className="fin-empty-ico">{subs.length === 0 ? "🔁" : "🔍"}</div>
          <div className="fin-empty-tit">
            {subs.length === 0 ? "No subscriptions tracked yet" : "No matches"}
          </div>
          <div className="fin-empty-sub">
            {subs.length === 0
              ? "Add Claude, Cursor, GitHub or any recurring bill to start watching renewals."
              : "Try a different search or status filter."}
          </div>
          {subs.length === 0 && (
            <button className="fin-empty-btn" onClick={() => setShowForm(true)}>
              New Subscription
            </button>
          )}
        </div>
      ) : (
        <div className="fin-grid">
          {filtered.map((d) => {
            const sub = d.sub;
            const pillClass =
              d.status === "active"
                ? "paid"
                : d.status === "warning"
                ? "unpaid"
                : d.status === "expired"
                ? "overdue"
                : "draft";
            const phrase =
              d.status === "expired"
                ? `Expired ${Math.abs(d.daysLeft)}d ago`
                : d.status === "paused"
                ? "Paused"
                : d.daysLeft === 0
                ? "Renews today"
                : `Renews in ${d.daysLeft}d`;
            const subPayments = payments.filter((p) => p.subscriptionId === sub.id);
            return (
              <article className="fin-card" key={sub.id}>
                <div className="fin-card-top">
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="fin-card-id">{sub.vendor || "Subscription"}</div>
                    <div className="fin-card-client">{sub.name}</div>
                    <div className="fin-card-email">
                      {sub.cycleDays}-day cycle · {fmtMoney(d.monthly, sub.currency)}/mo
                    </div>
                  </div>
                  <span className={"fin-pill " + pillClass}>
                    {d.status === "warning" ? "renew" : d.status}
                  </span>
                </div>

                <div className="fin-card-amt-wrap">
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span className="fin-card-amt-lbl">Per cycle</span>
                    <span
                      className="fin-card-meta"
                      style={
                        d.status === "expired"
                          ? { color: "var(--red)", fontWeight: 600 }
                          : d.status === "warning"
                          ? { color: "var(--yellow)", fontWeight: 600 }
                          : undefined
                      }
                    >
                      {phrase} · expires {fmtDate(sub.expiresAt)}
                    </span>
                  </div>
                  <span className="fin-card-amt">{fmtMoney(sub.amount, sub.currency)}</span>
                </div>

                <div className="fin-card-foot">
                  <span className="fin-card-meta">
                    Last paid {fmtDate(sub.lastPaidAt)} ·{" "}
                    <button
                      type="button"
                      className="sub-history-toggle"
                      onClick={() =>
                        setHistoryOpen((cur) => (cur === sub.id ? null : sub.id))
                      }
                    >
                      {subPayments.length} payment{subPayments.length === 1 ? "" : "s"}
                      {historyOpen === sub.id ? " ▴" : " ▾"}
                    </button>
                  </span>
                  <div className="fin-card-acts">
                    <button
                      className="btn bp sub-pay-btn"
                      type="button"
                      onClick={() => setPaying(sub)}
                    >
                      Log payment
                    </button>
                    <button
                      className="fin-status-sel"
                      type="button"
                      onClick={() => onUpdate(sub.id, { active: !sub.active })}
                      aria-label={sub.active ? "Pause" : "Resume"}
                      title={sub.active ? "Pause" : "Resume"}
                    >
                      {sub.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      className="fin-icon-btn"
                      onClick={() => setEditing(sub)}
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
                      onClick={() => onDelete(sub.id)}
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

                {historyOpen === sub.id && (
                  <div className="sub-history">
                    {subPayments.length === 0 ? (
                      <div className="sub-history-empty">No payments logged yet.</div>
                    ) : (
                      subPayments.map((p) => (
                        <div className="sub-history-row" key={p.id}>
                          <span className="sub-history-date">{fmtDate(p.paidAt)}</span>
                          <span className="sub-history-amt">{fmtMoney(p.amount, sub.currency)}</span>
                          <span className="sub-history-notes">{p.notes || "—"}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <SubscriptionFormModal
          onSubmit={onCreate}
          onSuccess={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}
      {editing && (
        <SubscriptionFormModal
          initial={editing}
          onSubmit={(data) =>
            onUpdate(editing.id, {
              name: data.name,
              vendor: data.vendor,
              amount: data.amount,
              currency: data.currency,
              cycleDays: data.cycleDays,
              notes: data.notes,
            })
          }
          onSuccess={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      )}
      {paying && (
        <PaymentFormModal
          subscription={paying}
          onSubmit={(data) => onRecordPayment(paying, data)}
          onSuccess={() => setPaying(null)}
          onCancel={() => setPaying(null)}
        />
      )}
    </div>
  );
}

function SubscriptionFormModal({
  initial,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  initial?: Subscription;
  onSubmit: (data: {
    name: string;
    vendor: string;
    amount: number;
    currency: string;
    cycleDays: number;
    lastPaidAt: string;
    notes: string;
  }) => void | Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [amountDollars, setAmountDollars] = useState<string>(
    initial ? (initial.amount / 100).toFixed(2) : ""
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "USD");
  const [cycleDays, setCycleDays] = useState(initial?.cycleDays ?? 30);
  const [lastPaidAt, setLastPaidAt] = useState(
    dateInputValue(initial?.lastPaidAt ?? "") || new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const submit = async () => {
    if (pending) return;
    if (!name.trim() || !lastPaidAt) {
      setError("Fill in name and the last billing date.");
      return;
    }
    const cents = Math.round(parseFloat(amountDollars || "0") * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError("Amount must be a positive number.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        vendor: vendor.trim(),
        amount: cents,
        currency: currency.trim() || "USD",
        cycleDays,
        lastPaidAt: new Date(lastPaidAt).toISOString(),
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the subscription.");
      setPending(false);
    }
  };

  return (
    <div className="mo open" onClick={onCancel}>
      <div className="modal fin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="m-title">{initial ? "Edit Subscription" : "New Subscription"}</div>

        <div className="fin-form-sec">
          <div className="frow">
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Name</label>
              <input
                className="fi"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Claude Pro"
                required
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Vendor</label>
              <input
                className="fi"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="Anthropic"
              />
            </div>
          </div>
          <div className="frow" style={{ marginTop: 10 }}>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Amount per cycle</label>
              <input
                className="fi"
                type="number"
                step="0.01"
                min={0}
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                placeholder="20.00"
                required
              />
            </div>
            <div className="fg" style={{ marginBottom: 0, maxWidth: 100 }}>
              <label className="fl">Currency</label>
              <input
                className="fi"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
            <div className="fg" style={{ marginBottom: 0, maxWidth: 120 }}>
              <label className="fl">Cycle (days)</label>
              <input
                className="fi"
                type="number"
                min={1}
                max={366}
                value={cycleDays}
                onChange={(e) => setCycleDays(Number(e.target.value) || 30)}
              />
            </div>
          </div>
          <div className="frow" style={{ marginTop: 10 }}>
            <div className="fg" style={{ marginBottom: 0, maxWidth: 220 }}>
              <label className="fl">Last paid on</label>
              <input
                className="fi"
                type="date"
                value={lastPaidAt}
                onChange={(e) => setLastPaidAt(e.target.value)}
                required
                disabled={!!initial}
                title={initial ? "Use 'Log payment' to record a renewal" : undefined}
              />
            </div>
          </div>
          <div className="fg" style={{ marginTop: 10, marginBottom: 0 }}>
            <label className="fl">Notes</label>
            <textarea
              className="ft"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Plan tier, seat count, billing email…"
            />
          </div>
        </div>

        {error && <div className="fin-form-error">{error}</div>}

        <div className="m-acts">
          <button type="button" className="btn bg" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn bp" onClick={submit} disabled={pending}>
            {pending && <span className="fin-spinner" aria-hidden="true" />}
            {pending
              ? initial
                ? "Saving…"
                : "Creating…"
              : initial
              ? "Save changes"
              : "Create subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentFormModal({
  subscription,
  onSubmit,
  onSuccess,
  onCancel,
}: {
  subscription: Subscription;
  onSubmit: (data: { paidAt: string; amount: number; notes: string }) => void | Promise<void>;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [amountDollars, setAmountDollars] = useState((subscription.amount / 100).toFixed(2));
  const [notes, setNotes] = useState("");

  const newExpiry = new Date(
    new Date(paidAt).getTime() + subscription.cycleDays * 24 * 60 * 60 * 1000
  );

  const submit = async () => {
    if (pending) return;
    const cents = Math.round(parseFloat(amountDollars || "0") * 100);
    if (!paidAt || !Number.isFinite(cents) || cents < 0) {
      setError("Pick a valid date and amount.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        paidAt: new Date(paidAt).toISOString(),
        amount: cents,
        notes: notes.trim(),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log payment.");
      setPending(false);
    }
  };

  return (
    <div className="mo open" onClick={onCancel}>
      <div className="modal fin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div className="m-title">Log payment · {subscription.name}</div>

        <div className="fin-form-sec">
          <div className="frow">
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Paid on</label>
              <input
                className="fi"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
              />
            </div>
            <div className="fg" style={{ marginBottom: 0 }}>
              <label className="fl">Amount ({subscription.currency})</label>
              <input
                className="fi"
                type="number"
                step="0.01"
                min={0}
                value={amountDollars}
                onChange={(e) => setAmountDollars(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="fg" style={{ marginTop: 10, marginBottom: 0 }}>
            <label className="fl">Notes</label>
            <input
              className="fi"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Receipt #, payment method…"
            />
          </div>
          <div className="sub-pay-preview">
            New expiry will be{" "}
            <strong>
              {newExpiry.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </strong>{" "}
            ({subscription.cycleDays}-day cycle).
          </div>
        </div>

        {error && <div className="fin-form-error">{error}</div>}

        <div className="m-acts">
          <button type="button" className="btn bg" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className="btn bp" onClick={submit} disabled={pending}>
            {pending && <span className="fin-spinner" aria-hidden="true" />}
            {pending ? "Logging…" : "Log payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

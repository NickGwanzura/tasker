"use client";

import type { Invoice } from "./Invoices";

export type CompanyInfo = {
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyTaxId: string;
  companyWebsite: string;
  displayName: string;
  accentColor: string;
};

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escape(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return escape(s).replace(/\n/g, "<br/>");
}

export function buildInvoiceHtml(inv: Invoice, company: CompanyInfo): string {
  const accent = company.accentColor || "#3b5bdb";
  const fromName = company.companyName.trim() || company.displayName || "Your Company";
  const invLabel = inv.invoiceNumber || `#${inv.id > 0 ? inv.id : "DRAFT"}`;

  const itemsHtml = inv.items
    .map((it) => {
      const discountBadge = it.discount && it.discount > 0
        ? `<span style="font-size:9px;color:#888;margin-left:4px">${it.discount}% off</span>`
        : "";
      const details = it.details?.trim()
        ? `<div class="item-details">${nl2br(it.details)}</div>`
        : "";
      return `
        <tr>
          <td><div class="item-title">${escape(it.description)}${discountBadge}</div>${details}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${fmtMoney(it.rate)}</td>
          <td class="num">${fmtMoney(it.amount)}</td>
        </tr>`;
    })
    .join("");

  const discountRow = inv.discount > 0
    ? `<div class="tot-row"><span>Discount</span><span style="color:#c92a2a">− ${fmtMoney(inv.discount)}</span></div>`
    : "";

  const statusColors: Record<string, string> = {
    paid: "background:#e3f9f5;color:#0ca678",
    partial: "background:#fff4e6;color:#e8590c",
    unpaid: "background:#fff3bf;color:#c2410c",
    overdue: "background:#fff5f5;color:#c92a2a",
  };
  const statusStyle = statusColors[inv.status] || statusColors.unpaid;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(invLabel)} — ${escape(fromName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    color: #111;
    background: #fff;
    margin: 0;
    padding: 28px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    font-size: 12px;
    line-height: 1.5;
  }
  .toolbar {
    position: sticky;
    top: 0;
    background: #fafafa;
    border: 1px solid #e6e6e6;
    border-radius: 8px;
    padding: 10px 14px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .toolbar button {
    background: ${accent};
    color: #fff;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
  }
  .toolbar button.secondary {
    background: #fff;
    color: #333;
    border: 1px solid #d0d0d0;
  }
  .toolbar .hint { color: #666; margin-left: auto; font-size: 11px; }
  @media print { .toolbar { display: none; } body { padding: 0; } }

  .sheet { max-width: 780px; margin: 0 auto; }

  /* ── Header band ── */
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 32px;
    padding-bottom: 20px;
    margin-bottom: 24px;
    border-bottom: 3px solid ${accent};
  }
  .from-name {
    font-size: 20px;
    font-weight: 800;
    color: #0f1120;
    letter-spacing: -0.02em;
    margin: 0 0 6px;
  }
  .from-detail { color: #555; font-size: 11.5px; line-height: 1.6; white-space: pre-wrap; }

  /* Invoice meta (right side) */
  .inv-meta { text-align: right; min-width: 200px; }
  .inv-meta-tag {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #aaa;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .inv-number {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${accent};
    margin-bottom: 10px;
  }
  .inv-date-row { font-size: 11.5px; color: #444; margin: 3px 0; }
  .inv-date-row strong { color: #111; }
  .status-badge {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    ${statusStyle};
  }

  /* ── Parties ── */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
    padding: 16px 20px;
    background: #f8f9fc;
    border-radius: 10px;
  }
  .party-label {
    font-size: 9.5px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #999;
    font-weight: 700;
    margin-bottom: 5px;
  }
  .party-name { font-weight: 700; font-size: 14px; color: #0f1120; }
  .party-line { color: #555; font-size: 11.5px; white-space: pre-wrap; margin-top: 2px; }

  /* ── Items table ── */
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
    font-size: 12px;
  }
  table.items thead th {
    background: ${accent};
    color: #fff;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    padding: 9px 12px;
  }
  table.items thead th.num { text-align: right; }
  table.items tbody tr:nth-child(even) { background: #f8f9fc; }
  table.items tbody td {
    padding: 10px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  table.items tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  table.items tbody tr:last-child td { border-bottom: none; }
  .item-title { font-weight: 650; color: #111; }
  .item-details { margin-top: 3px; color: #666; font-size: 10.8px; line-height: 1.45; white-space: pre-wrap; }

  /* ── Totals ── */
  .totals-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 0;
    border: 1px solid #e6e6e6;
    border-top: none;
    border-radius: 0 0 8px 8px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .totals {
    width: 300px;
    padding: 14px 16px 10px;
    background: #fafbff;
  }
  .tot-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    font-size: 12px;
    color: #555;
  }
  .tot-row.grand {
    border-top: 2px solid ${accent};
    margin-top: 8px;
    padding-top: 10px;
    font-size: 16px;
    font-weight: 800;
    color: #0f1120;
  }
  .tot-row.grand span:last-child { color: ${accent}; }

  /* ── Payment progress ── */
  .payment-section {
    margin-bottom: 20px;
    padding: 14px 16px;
    background: #f0faf5;
    border: 1px solid #b2f2d6;
    border-radius: 8px;
  }
  .payment-section h4 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #0ca678;
    font-weight: 700;
    margin: 0 0 8px;
  }
  .pbar-wrap { height: 6px; background: #c3fae8; border-radius: 99px; overflow: hidden; margin: 6px 0 4px; }
  .pbar-fill { height: 100%; background: #0ca678; border-radius: 99px; }
  .pbar-labels { display: flex; justify-content: space-between; font-size: 10.5px; color: #0ca678; font-weight: 600; }

  /* ── Notes ── */
  .notes {
    margin-bottom: 24px;
    padding: 14px 16px;
    background: #fffbe6;
    border: 1px solid #ffe066;
    border-radius: 8px;
  }
  .notes h4 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #c2410c;
    font-weight: 700;
    margin: 0 0 6px;
  }
  .notes p { margin: 0; color: #444; white-space: pre-wrap; font-size: 11.5px; }

  /* ── Footer ── */
  .footer {
    padding-top: 14px;
    border-top: 1px dashed #ccc;
    font-size: 10px;
    color: #aaa;
    text-align: center;
    letter-spacing: 0.03em;
  }
</style>
</head>
<body>
  <div class="toolbar" id="invoice-toolbar">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">In the print dialog, choose "Save as PDF" to download.</span>
  </div>

  <div class="sheet">
    <div class="head">
      <div class="from">
        <div class="from-name">${escape(fromName)}</div>
        ${company.companyAddress ? `<div class="from-detail">${nl2br(company.companyAddress)}</div>` : ""}
        ${company.companyEmail ? `<div class="from-detail">${escape(company.companyEmail)}</div>` : ""}
        ${company.companyPhone ? `<div class="from-detail">${escape(company.companyPhone)}</div>` : ""}
        ${company.companyWebsite ? `<div class="from-detail">${escape(company.companyWebsite)}</div>` : ""}
        ${company.companyTaxId ? `<div class="from-detail">Tax ID: ${escape(company.companyTaxId)}</div>` : ""}
      </div>
      <div class="inv-meta">
        <div class="inv-meta-tag">Invoice</div>
        <div class="inv-number">${escape(invLabel)}</div>
        <div class="inv-date-row"><strong>Issued:</strong> ${fmtDate(inv.createdAt && /^\d{4}-/.test(inv.createdAt) ? inv.createdAt : new Date().toISOString())}</div>
        <div class="inv-date-row"><strong>Due:</strong> ${fmtDate(inv.dueDate)}</div>
        <div><span class="status-badge">${escape(inv.status)}</span></div>
      </div>
    </div>

    <div class="parties">
      <div>
        <div class="party-label">Bill to</div>
        <div class="party-name">${escape(inv.clientName) || "—"}</div>
        ${inv.clientEmail ? `<div class="party-line">${escape(inv.clientEmail)}</div>` : ""}
        ${inv.clientAddress ? `<div class="party-line">${nl2br(inv.clientAddress)}</div>` : ""}
      </div>
      <div>
        <div class="party-label">Summary</div>
        <div class="party-line">${inv.items.length} line item${inv.items.length === 1 ? "" : "s"}</div>
        <div class="party-line" style="font-size:15px;font-weight:700;color:#0f1120;margin-top:4px">${fmtMoney(inv.total)}</div>
        ${inv.paidAmount > 0 ? `<div class="party-line" style="color:#0ca678">${fmtMoney(inv.paidAmount)} received</div>` : ""}
        ${inv.total > inv.paidAmount ? `<div class="party-line" style="color:#c2410c;font-weight:600">${fmtMoney(inv.total - inv.paidAmount)} outstanding</div>` : ""}
      </div>
    </div>

    <table class="items">
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml || `<tr><td colspan="4" style="color:#999;text-align:center;padding:20px">No line items</td></tr>`}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals">
        <div class="tot-row"><span>Subtotal</span><span>${fmtMoney(inv.subtotal)}</span></div>
        ${discountRow}
        <div class="tot-row"><span>Tax</span><span>${fmtMoney(inv.tax)}</span></div>
        <div class="tot-row grand"><span>Total</span><span>${fmtMoney(inv.total)}</span></div>
      </div>
    </div>

    ${inv.paidAmount > 0 && inv.status !== "paid" ? `
    <div class="payment-section">
      <h4>Payment progress</h4>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#555">
        <span>Paid <strong style="color:#0ca678">${fmtMoney(inv.paidAmount)}</strong></span>
        <span>Remaining <strong style="color:#c2410c">${fmtMoney(inv.total - inv.paidAmount)}</strong></span>
      </div>
      <div class="pbar-wrap"><div class="pbar-fill" style="width:${inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0}%"></div></div>
      <div class="pbar-labels"><span>${inv.total > 0 ? Math.round((inv.paidAmount / inv.total) * 100) : 0}% paid</span><span>Balance due ${fmtDate(inv.dueDate)}</span></div>
    </div>` : ""}

    ${inv.notes ? `
    <div class="notes">
      <h4>Notes</h4>
      <p>${nl2br(inv.notes)}</p>
    </div>` : ""}

    <div class="footer">
      Thank you for your business &mdash; ${escape(fromName)}
      ${company.companyEmail ? ` &bull; ${escape(company.companyEmail)}` : ""}
    </div>
  </div>
</body>
</html>`;
}

function openInvoiceWindow(inv: Invoice, company: CompanyInfo, autoPrint: boolean) {
  const html = buildInvoiceHtml(inv, company);
  const finalHtml = autoPrint
    ? html.replace(
        "</body>",
        `  <script>
    window.addEventListener('load', function() {
      setTimeout(function(){ try { window.print(); } catch (e) {} }, 350);
    });
  </script>
</body>`
      )
    : html;
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    const blob = new Blob([finalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = inv.invoiceNumber || `invoice-${inv.id || "draft"}`;
    a.download = `${label}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert(
      "Pop-ups were blocked. The invoice was downloaded as HTML — open it and use your browser's Print → Save as PDF."
    );
    return;
  }
  const blob = new Blob([finalHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function previewInvoice(inv: Invoice, company: CompanyInfo) {
  openInvoiceWindow(inv, company, false);
}

export function downloadInvoicePdf(inv: Invoice, company: CompanyInfo) {
  openInvoiceWindow(inv, company, true);
}

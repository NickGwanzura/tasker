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
  const itemsHtml = inv.items
    .map(
      (it) => `
        <tr>
          <td>${escape(it.description)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${fmtMoney(it.rate)}</td>
          <td class="num">${fmtMoney(it.amount)}</td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Invoice #${inv.id} — ${escape(fromName)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
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
    padding: 10px 12px;
    margin-bottom: 18px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
  }
  .toolbar button {
    background: ${accent};
    color: #fff;
    border: none;
    padding: 8px 14px;
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
  .toolbar .hint { color: #666; margin-left: auto; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
  .sheet { max-width: 760px; margin: 0 auto; }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    margin-bottom: 28px;
    padding-bottom: 18px;
    border-bottom: 2px solid ${accent};
  }
  .from h1 {
    font-size: 22px;
    font-weight: 800;
    margin: 0 0 6px;
    letter-spacing: -0.02em;
    color: #0f1120;
  }
  .from .muted { color: #555; font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; }
  .meta { text-align: right; }
  .meta .label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
  }
  .meta .num {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: ${accent};
    margin: 2px 0 12px;
  }
  .meta .row { font-size: 11.5px; color: #444; margin: 2px 0; }
  .meta .row strong { color: #111; }
  .status {
    display: inline-block;
    margin-top: 8px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .status.paid { background: #e3f9f5; color: #0ca678; }
  .status.unpaid { background: #fff3bf; color: #c2410c; }
  .status.overdue { background: #fff5f5; color: #c92a2a; }
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-bottom: 24px;
  }
  .parties h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin: 0 0 6px;
  }
  .parties .name { font-weight: 700; font-size: 14px; color: #0f1120; }
  .parties .lines { color: #444; font-size: 11.5px; white-space: pre-wrap; }
  table.items {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 18px;
    font-size: 12px;
  }
  table.items thead th {
    background: #f5f6fb;
    text-align: left;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #555;
    font-weight: 700;
    padding: 10px 12px;
    border-bottom: 1px solid #e6e6e6;
  }
  table.items thead th.num { text-align: right; }
  table.items tbody td {
    padding: 11px 12px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  table.items tbody td.num { text-align: right; font-variant-numeric: tabular-nums; }
  .totals {
    width: 280px;
    margin-left: auto;
    margin-bottom: 24px;
  }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    font-size: 12px;
    color: #444;
  }
  .totals .row.total {
    border-top: 1.5px solid #111;
    margin-top: 6px;
    padding-top: 10px;
    font-size: 15px;
    font-weight: 800;
    color: #0f1120;
  }
  .notes {
    margin-top: 24px;
    padding-top: 14px;
    border-top: 1px solid #eee;
  }
  .notes h3 {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #888;
    margin: 0 0 6px;
  }
  .notes p { margin: 0; color: #444; white-space: pre-wrap; font-size: 11.5px; }
  .footer {
    margin-top: 36px;
    padding-top: 14px;
    border-top: 1px dashed #ccc;
    font-size: 10.5px;
    color: #888;
    text-align: center;
  }
</style>
</head>
<body>
  <div class="toolbar" id="invoice-toolbar">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">In the print dialog choose “Save as PDF” to download.</span>
  </div>

  <div class="sheet">
    <div class="head">
      <div class="from">
        <h1>${escape(fromName)}</h1>
        <div class="muted">${nl2br(company.companyAddress)}</div>
        ${
          company.companyEmail
            ? `<div class="muted">${escape(company.companyEmail)}</div>`
            : ""
        }
        ${
          company.companyPhone
            ? `<div class="muted">${escape(company.companyPhone)}</div>`
            : ""
        }
        ${
          company.companyWebsite
            ? `<div class="muted">${escape(company.companyWebsite)}</div>`
            : ""
        }
        ${
          company.companyTaxId
            ? `<div class="muted">Tax ID: ${escape(company.companyTaxId)}</div>`
            : ""
        }
      </div>
      <div class="meta">
        <div class="label">Invoice</div>
        <div class="num">#${inv.id > 0 ? inv.id : "—"}</div>
        <div class="row"><strong>Issued:</strong> ${fmtDate(inv.createdAt && /^\d{4}-/.test(inv.createdAt) ? inv.createdAt : new Date().toISOString())}</div>
        <div class="row"><strong>Due:</strong> ${fmtDate(inv.dueDate)}</div>
        <span class="status ${escape(inv.status)}">${escape(inv.status)}</span>
      </div>
    </div>

    <div class="parties">
      <div>
        <h3>Bill to</h3>
        <div class="name">${escape(inv.clientName) || "—"}</div>
        ${inv.clientEmail ? `<div class="lines">${escape(inv.clientEmail)}</div>` : ""}
        ${inv.clientAddress ? `<div class="lines">${nl2br(inv.clientAddress)}</div>` : ""}
      </div>
      <div>
        <h3>Summary</h3>
        <div class="lines">${inv.items.length} line item${inv.items.length === 1 ? "" : "s"}</div>
        <div class="lines"><strong>${fmtMoney(inv.total)}</strong> due</div>
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

    <div class="totals">
      <div class="row"><span>Subtotal</span><span>${fmtMoney(inv.subtotal)}</span></div>
      <div class="row"><span>Tax</span><span>${fmtMoney(inv.tax)}</span></div>
      <div class="row total"><span>Total</span><span>${fmtMoney(inv.total)}</span></div>
    </div>

    ${
      inv.notes
        ? `<div class="notes"><h3>Notes</h3><p>${nl2br(inv.notes)}</p></div>`
        : ""
    }

    <div class="footer">
      Thank you for your business — ${escape(fromName)}
    </div>
  </div>
  <script>
    // Auto-trigger print dialog after a short delay so layout settles.
    window.addEventListener('load', function() {
      setTimeout(function(){ try { window.print(); } catch (e) {} }, 350);
    });
  </script>
</body>
</html>`;
}

export function downloadInvoicePdf(inv: Invoice, company: CompanyInfo) {
  const html = buildInvoiceHtml(inv, company);
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    // Fallback: download as HTML if popup blocked
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${inv.id || "draft"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    alert(
      "Pop-ups were blocked. The invoice was downloaded as HTML — open it and use your browser's Print → Save as PDF."
    );
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

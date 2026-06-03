"use client";

import type { Quote } from "./Quotes";
import type { CompanyInfo } from "./invoicePdf";

function fmtMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
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

export function buildQuoteHtml(quote: Quote, company: CompanyInfo): string {
  const accent = company.accentColor || "#3b5bdb";
  const fromName = company.companyName.trim() || company.displayName || "Your Company";
  const quoteLabel = `Quote #${quote.id > 0 ? quote.id : "DRAFT"}`;
  const itemsHtml = quote.items
    .map((it) => {
      const details = it.details?.trim()
        ? `<div class="item-details">${nl2br(it.details)}</div>`
        : "";
      return `
        <tr>
          <td><div class="item-title">${escape(it.description)}</div>${details}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${fmtMoney(it.rate)}</td>
          <td class="num">${fmtMoney(it.amount)}</td>
        </tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(quoteLabel)} - ${escape(fromName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color:#111; background:#fff; margin:0; padding:28px; font-size:12px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .toolbar { position:sticky; top:0; background:#fafafa; border:1px solid #e6e6e6; border-radius:8px; padding:10px 14px; margin-bottom:20px; display:flex; align-items:center; gap:8px; font-size:12px; }
  .toolbar button { background:${accent}; color:#fff; border:0; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:12px; }
  .toolbar button.secondary { background:#fff; color:#333; border:1px solid #d0d0d0; }
  .toolbar .hint { margin-left:auto; color:#666; font-size:11px; }
  @media print { .toolbar { display:none; } body { padding:0; } }
  .sheet { max-width:780px; margin:0 auto; }
  .head { display:flex; justify-content:space-between; align-items:flex-start; gap:32px; padding-bottom:20px; margin-bottom:24px; border-bottom:3px solid ${accent}; }
  .from-name { font-size:20px; font-weight:800; color:#0f1120; margin:0 0 6px; }
  .from-detail { color:#555; font-size:11.5px; line-height:1.6; white-space:pre-wrap; }
  .doc-meta { text-align:right; min-width:200px; }
  .doc-tag { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#aaa; font-weight:700; }
  .doc-number { font-size:26px; font-weight:800; color:${accent}; margin:2px 0 8px; }
  .status-badge { display:inline-block; margin-top:8px; padding:4px 12px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; background:#f1f3f5; color:#495057; }
  .parties { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; padding:16px 20px; background:#f8f9fc; border-radius:10px; }
  .party-label { font-size:9.5px; text-transform:uppercase; letter-spacing:.12em; color:#999; font-weight:800; margin-bottom:5px; }
  .party-name { font-weight:800; font-size:14px; color:#0f1120; }
  .party-line { color:#555; font-size:11.5px; white-space:pre-wrap; margin-top:2px; }
  table.items { width:100%; border-collapse:collapse; font-size:12px; }
  table.items thead th { background:${accent}; color:#fff; text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.08em; font-weight:800; padding:9px 12px; }
  table.items thead th.num, table.items tbody td.num { text-align:right; }
  table.items tbody tr:nth-child(even) { background:#f8f9fc; }
  table.items tbody td { padding:10px 12px; border-bottom:1px solid #eee; vertical-align:top; }
  table.items tbody td.num { font-variant-numeric:tabular-nums; }
  .item-title { font-weight:650; color:#111; }
  .item-details { margin-top:3px; color:#666; font-size:10.8px; line-height:1.45; white-space:pre-wrap; }
  .totals-wrap { display:flex; justify-content:flex-end; border:1px solid #e6e6e6; border-top:0; border-radius:0 0 8px 8px; overflow:hidden; margin-bottom:24px; }
  .totals { width:300px; padding:14px 16px 10px; background:#fafbff; }
  .tot-row { display:flex; justify-content:space-between; padding:5px 0; color:#555; }
  .tot-row.grand { border-top:2px solid ${accent}; margin-top:8px; padding-top:10px; font-size:16px; font-weight:800; color:#0f1120; }
  .tot-row.grand span:last-child { color:${accent}; }
  .notes { margin-bottom:24px; padding:14px 16px; background:#fffbe6; border:1px solid #ffe066; border-radius:8px; }
  .notes h4 { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:#c2410c; margin:0 0 6px; }
  .notes p { margin:0; color:#444; white-space:pre-wrap; font-size:11.5px; }
  .footer { padding-top:14px; border-top:1px dashed #ccc; font-size:10px; color:#aaa; text-align:center; letter-spacing:.03em; }
</style>
</head>
<body>
  <div class="toolbar">
    <button onclick="window.print()">Save as PDF / Print</button>
    <button class="secondary" onclick="window.close()">Close</button>
    <span class="hint">In the print dialog, choose "Save as PDF" to download.</span>
  </div>
  <div class="sheet">
    <div class="head">
      <div>
        <div class="from-name">${escape(fromName)}</div>
        ${company.companyAddress ? `<div class="from-detail">${nl2br(company.companyAddress)}</div>` : ""}
        ${company.companyEmail ? `<div class="from-detail">${escape(company.companyEmail)}</div>` : ""}
        ${company.companyPhone ? `<div class="from-detail">${escape(company.companyPhone)}</div>` : ""}
        ${company.companyWebsite ? `<div class="from-detail">${escape(company.companyWebsite)}</div>` : ""}
      </div>
      <div class="doc-meta">
        <div class="doc-tag">Quote</div>
        <div class="doc-number">${escape(quoteLabel)}</div>
        <div><span class="status-badge">${escape(quote.status)}</span></div>
      </div>
    </div>
    <div class="parties">
      <div>
        <div class="party-label">Prepared for</div>
        <div class="party-name">${escape(quote.clientName) || "-"}</div>
        ${quote.clientEmail ? `<div class="party-line">${escape(quote.clientEmail)}</div>` : ""}
        ${quote.clientAddress ? `<div class="party-line">${nl2br(quote.clientAddress)}</div>` : ""}
      </div>
      <div>
        <div class="party-label">Summary</div>
        <div class="party-line">${quote.items.length} line item${quote.items.length === 1 ? "" : "s"}</div>
        <div class="party-line" style="font-size:15px;font-weight:800;color:#0f1120;margin-top:4px">${fmtMoney(quote.total)}</div>
      </div>
    </div>
    <table class="items">
      <thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
      <tbody>${itemsHtml || `<tr><td colspan="4" style="color:#999;text-align:center;padding:20px">No line items</td></tr>`}</tbody>
    </table>
    <div class="totals-wrap">
      <div class="totals">
        <div class="tot-row"><span>Subtotal</span><span>${fmtMoney(quote.subtotal)}</span></div>
        <div class="tot-row"><span>Tax</span><span>${fmtMoney(quote.tax)}</span></div>
        <div class="tot-row grand"><span>Total</span><span>${fmtMoney(quote.total)}</span></div>
      </div>
    </div>
    ${quote.notes ? `<div class="notes"><h4>Notes</h4><p>${nl2br(quote.notes)}</p></div>` : ""}
    <div class="footer">${escape(fromName)}${company.companyEmail ? ` &bull; ${escape(company.companyEmail)}` : ""}</div>
  </div>
</body>
</html>`;
}

function openQuoteWindow(quote: Quote, company: CompanyInfo, autoPrint: boolean) {
  const html = buildQuoteHtml(quote, company);
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
    a.download = `quote-${quote.id || "draft"}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return;
  }
  const blob = new Blob([finalHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  win.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function previewQuote(quote: Quote, company: CompanyInfo) {
  openQuoteWindow(quote, company, false);
}

export function downloadQuotePdf(quote: Quote, company: CompanyInfo) {
  openQuoteWindow(quote, company, true);
}

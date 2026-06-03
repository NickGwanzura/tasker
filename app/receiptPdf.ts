"use client";

import type { Invoice } from "./Invoices";
import type { Receipt } from "./Receipts";
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

export function buildReceiptHtml(receipt: Receipt, invoice: Invoice | undefined, company: CompanyInfo): string {
  const accent = company.accentColor || "#3b5bdb";
  const fromName = company.companyName.trim() || company.displayName || "Your Company";
  const receiptLabel = `Receipt #${receipt.id > 0 ? receipt.id : "DRAFT"}`;
  const invoiceLabel = invoice?.invoiceNumber || `Invoice #${receipt.invoiceId}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(receiptLabel)} - ${escape(fromName)}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; color:#111; background:#fff; margin:0; padding:28px; font-size:12px; line-height:1.5; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .toolbar { position:sticky; top:0; background:#fafafa; border:1px solid #e6e6e6; border-radius:8px; padding:10px 14px; margin-bottom:20px; display:flex; align-items:center; gap:8px; font-size:12px; }
  .toolbar button { background:${accent}; color:#fff; border:0; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700; font-size:12px; }
  .toolbar button.secondary { background:#fff; color:#333; border:1px solid #d0d0d0; }
  .toolbar .hint { margin-left:auto; color:#666; font-size:11px; }
  @media print { .toolbar { display:none; } body { padding:0; } }
  .sheet { max-width:720px; margin:0 auto; }
  .head { display:flex; justify-content:space-between; gap:32px; padding-bottom:20px; margin-bottom:24px; border-bottom:3px solid ${accent}; }
  .from-name { font-size:20px; font-weight:800; color:#0f1120; margin:0 0 6px; }
  .from-detail { color:#555; font-size:11.5px; line-height:1.6; white-space:pre-wrap; }
  .doc-meta { text-align:right; min-width:200px; }
  .doc-tag { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#aaa; font-weight:800; }
  .doc-number { font-size:26px; font-weight:800; color:${accent}; margin:2px 0 8px; }
  .paid-badge { display:inline-block; margin-top:8px; padding:4px 12px; border-radius:999px; font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; background:#e3f9f5; color:#0ca678; }
  .amount { padding:26px 28px; background:#f8f9fc; border-radius:12px; margin-bottom:20px; text-align:center; }
  .amount-label { font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#999; font-weight:800; margin-bottom:5px; }
  .amount-value { font-size:34px; line-height:1; color:${accent}; font-weight:850; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:22px; }
  .box { border:1px solid #e6e6e6; border-radius:10px; padding:14px 16px; }
  .box-label { font-size:9.5px; text-transform:uppercase; letter-spacing:.12em; color:#999; font-weight:800; margin-bottom:6px; }
  .box-main { font-size:14px; color:#0f1120; font-weight:800; }
  .box-line { color:#555; font-size:11.5px; margin-top:2px; white-space:pre-wrap; }
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
        <div class="doc-tag">Payment Receipt</div>
        <div class="doc-number">${escape(receiptLabel)}</div>
        <div><span class="paid-badge">Received</span></div>
      </div>
    </div>
    <div class="amount">
      <div class="amount-label">Amount received</div>
      <div class="amount-value">${fmtMoney(receipt.amount)}</div>
    </div>
    <div class="grid">
      <div class="box">
        <div class="box-label">Received from</div>
        <div class="box-main">${escape(invoice?.clientName || "Client")}</div>
        ${invoice?.clientEmail ? `<div class="box-line">${escape(invoice.clientEmail)}</div>` : ""}
        ${invoice?.clientAddress ? `<div class="box-line">${nl2br(invoice.clientAddress)}</div>` : ""}
      </div>
      <div class="box">
        <div class="box-label">Payment details</div>
        <div class="box-main">${escape(receipt.paymentMethod)}</div>
        <div class="box-line">${escape(invoiceLabel)}</div>
        <div class="box-line">${escape(receipt.createdAt)}</div>
        ${receipt.transactionId ? `<div class="box-line">Transaction: ${escape(receipt.transactionId)}</div>` : ""}
      </div>
    </div>
    ${receipt.notes ? `<div class="notes"><h4>Notes</h4><p>${nl2br(receipt.notes)}</p></div>` : ""}
    <div class="footer">${escape(fromName)}${company.companyEmail ? ` &bull; ${escape(company.companyEmail)}` : ""}</div>
  </div>
</body>
</html>`;
}

function openReceiptWindow(receipt: Receipt, invoice: Invoice | undefined, company: CompanyInfo, autoPrint: boolean) {
  const html = buildReceiptHtml(receipt, invoice, company);
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
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    const blob = new Blob([finalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receipt.id || "draft"}.html`;
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

export function previewReceipt(receipt: Receipt, invoice: Invoice | undefined, company: CompanyInfo) {
  openReceiptWindow(receipt, invoice, company, false);
}

export function downloadReceiptPdf(receipt: Receipt, invoice: Invoice | undefined, company: CompanyInfo) {
  openReceiptWindow(receipt, invoice, company, true);
}

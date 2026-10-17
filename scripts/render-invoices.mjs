// Renders data/invoices.json into the original-looking documents under data/invoices/
// (PDF and PNG via headless Chrome, .eml and chat .txt as text).
// usage: CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node scripts/render-invoices.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const invoices = JSON.parse(readFileSync("data/invoices.json", "utf8"));

mkdirSync("data/invoices", { recursive: true });

const english = (inv) => /LLC|Inc\./.test(inv.payeeName);
const money = (n, cur) => `${n.toLocaleString(cur === "USD" || cur === "EUR" ? "en-US" : "es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

function html(inv, scanned) {
  const en = english(inv);
  const t = en
    ? { title: "INVOICE", no: "Invoice #", issued: "Issue date", due: "Due date", bill: "Bill to", desc: "Description", amount: "Amount", total: "Total due", pay: "Payment details" }
    : { title: inv.payeeName.includes("SAS") || inv.payeeName.includes("SA de CV") ? "FACTURA" : "CUENTA DE COBRO", no: "N.º", issued: "Fecha de emisión", due: "Fecha de vencimiento", bill: "Cobrar a", desc: "Concepto", amount: "Valor", total: "Total a pagar", pay: "Datos para el pago" };
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 48px; width: 720px; ${scanned ? "filter: grayscale(1) contrast(1.1); transform: rotate(-0.6deg); background: #f4f1ea;" : ""} }
    .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #333; padding-bottom: 16px; }
    h1 { margin: 0; font-size: 26px; letter-spacing: 2px; }
    .payee { font-size: 18px; font-weight: bold; }
    .muted { color: #666; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 28px; }
    th { text-align: left; background: #eee; padding: 8px; font-size: 13px; }
    td { padding: 10px 8px; border-bottom: 1px solid #ddd; }
    .right { text-align: right; }
    .total { font-size: 18px; font-weight: bold; }
    .box { margin-top: 28px; padding: 12px 16px; border: 1px dashed #999; font-size: 14px; }
  </style></head><body>
    <div class="top">
      <div><div class="payee">${esc(inv.payeeName)}</div><div class="muted">${esc(inv.concept.split(" — ")[0])}</div></div>
      <div style="text-align:right"><h1>${t.title}</h1><div>${t.no} <b>${esc(inv.invoiceNumber)}</b></div>
        <div class="muted">${t.issued}: ${inv.issueDate}</div><div class="muted">${t.due}: ${inv.dueDate}</div></div>
    </div>
    <p style="margin-top:24px"><span class="muted">${t.bill}:</span><br><b>Andes Labs Inc.</b><br>251 Little Falls Dr, Wilmington, DE 19808, USA</p>
    <table><tr><th>${t.desc}</th><th class="right">${t.amount}</th></tr>
      <tr><td>${esc(inv.concept)}</td><td class="right">${money(inv.amount, inv.currency)}</td></tr>
      <tr><td class="right total">${t.total}</td><td class="right total">${money(inv.amount, inv.currency)}</td></tr></table>
    <div class="box"><b>${t.pay}:</b> ${esc(inv.payeeAccount ?? "")}</div>
    ${inv.rawText ? `<p class="box">${esc(inv.rawText).replace(/\n/g, "<br>")}</p>` : ""}
    <p class="muted" style="margin-top:40px">${en ? "Fictitious document generated for the 30X hackathon demo." : "Documento ficticio generado para la demo del hackathon 30X."}</p>
  </body></html>`;
}

function eml(inv) {
  const slug = inv.payeeName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
  return [
    `From: ${inv.payeeName} <${slug}@example.com>`,
    `To: Finanzas Andes Labs <finanzas@andeslabs.example>`,
    `Date: ${new Date(`${inv.issueDate}T15:30:00-05:00`).toUTCString()}`,
    `Subject: ${english(inv) ? "Invoice" : "Factura"} ${inv.invoiceNumber} - ${inv.concept}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    inv.rawText,
    "",
  ].join("\r\n");
}

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
for (const { file, invoice } of invoices) {
  const out = `data/${file}`;
  if (file.endsWith(".eml")) writeFileSync(out, eml(invoice));
  else if (file.endsWith(".txt")) writeFileSync(out, `${invoice.rawText}\n`);
  else {
    await page.setContent(html(invoice, file.endsWith(".png")));
    if (file.endsWith(".pdf")) await page.pdf({ path: out, format: "Letter", printBackground: true });
    else await page.screenshot({ path: out, fullPage: true });
  }
  console.log("rendered", out);
}
await browser.close();

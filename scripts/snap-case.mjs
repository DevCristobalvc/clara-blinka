// Dev utility: open a demo case on a running dev server and screenshot the public link.
// usage: CHROME_PATH=... node scripts/snap-case.mjs [invoiceFilePrefix=14] [out=docs/design/screens/case.png]
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const prefix = process.argv[2] ?? "14";
const out = process.argv[3] ?? `docs/design/screens/case-${prefix}.png`;
const sample = JSON.parse(readFileSync("data/invoices.json", "utf8")).find((x) => x.file.includes(`/${prefix}-`));

const created = await (await fetch(`${base}/api/cases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: sample.file }) })).json();
await fetch(`${base}/api/cases/${created.id}/invoice`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invoice: sample.invoice }) });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await page.goto(created.url, { waitUntil: "load" });
await page.waitForSelector("text=Conversación", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
console.log(created.url, "->", out);

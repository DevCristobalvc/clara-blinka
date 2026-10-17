// Records the demo as a video (webm) against a running server, following the narrative in docs/pitch.md:
// landing → login → Panel (invoices to pay) → the pagador is hired and funded with REAL x402 payments
// (scripts/x402-pay.mjs, test wallet) while the Panel is on screen → rules → "Pon a ORBIT a trabajar"
// → the board fills → Lucía's negotiation → the vendor's view → approvals → reports → Panel.
// usage: CHROME_PATH=... node --env-file=.env --env-file=.env.local scripts/record-demo.mjs [out dir = docs/demo]
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const outDir = process.argv[2] ?? "docs/demo";
mkdirSync(outDir, { recursive: true });
const canPay = Boolean(process.env.ORBIT_TEST_PAYER_PRIVATE_KEY);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: outDir, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const go = async (path, wait) => { await page.goto(base + path, { waitUntil: "load" }); if (wait) await page.waitForSelector(wait, { timeout: 120000 }); };
// The public facilitator occasionally fails on an RPC hiccup; retry a few times before giving up.
const pay = (action) => {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      execFileSync("node", ["scripts/x402-pay.mjs", action, "pagador"], { env: process.env, stdio: "inherit" });
      return;
    } catch (err) {
      console.warn(`${action}: attempt ${attempt} failed`);
      if (attempt === 4) throw err;
      execFileSync("sleep", ["5"]);
    }
  }
};

// Fresh company with no agent hired yet, and warm the server
await fetch(`${base}/api/reset?full=1`, { method: "POST" });
for (const p of ["/", "/login", "/app", "/app/facturas", "/app/reglas", "/app/aprobaciones", "/app/reportes"]) await fetch(base + p, { headers: { cookie: "orbit_session=demo" } }).catch(() => {});

// 0. The problem: landing
await go("/", "text=Actúa con autonomía");
await pause(3500);
await page.mouse.wheel(0, 650);
await pause(2500);

// 1. You are in your account: login, then the Panel with the invoices to pay
await go("/login", "text=Iniciar sesión");
await pause(2500);
await ctx.addCookies([{ name: "orbit_session", value: "demo", url: base }]);
await go("/app", "text=facturas por pagar");
await pause(4000);

// 2. Hire the pagador and fund it: real x402 payments from the test wallet while the Panel is on screen
if (canPay) {
  pay("activate");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("text=activo desde", { timeout: 60000 });
  await pause(3000);
  pay("fund");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("text=USDC en su wallet", { timeout: 60000 });
  await pause(3000);
} else {
  console.warn("ORBIT_TEST_PAYER_PRIVATE_KEY not set: skipping the real activation; the Panel stays on step 1");
  await pause(4000);
}

// 3. Rules
await go("/app/reglas", "text=Límites");
await pause(3500);
await page.mouse.wheel(0, 500);
await pause(2500);

// 4. Put it to work: from the Panel, then watch the board
await go("/app", "text=Pon a ORBIT a trabajar");
await pause(1500);
await page.click("text=Pon a ORBIT a trabajar");
await pause(5000);
await go("/app/facturas", "text=Facturas");
await page.waitForSelector("text=Set de demo completo", { timeout: 300000 });
await pause(2000);

// 5. Lucía's negotiation, then the vendor's view
await page.click("text=Lucía Fernández >> nth=0");
await page.waitForSelector("text=Negociación con el proveedor");
await pause(1500);
await page.mouse.wheel(0, 500);
await pause(4000);
const caseLink = await page.$eval("aside code", (el) => el.textContent);
await page.goto(caseLink, { waitUntil: "load" });
await page.waitForSelector("text=Conversación");
await pause(3500);
await page.mouse.wheel(0, 600);
await pause(3500);

// 6. Approvals
await go("/app/aprobaciones", "text=Aprobaciones");
await pause(3000);
await page.click("text=Aprobar pago >> nth=0").catch(() => {});
await pause(2500);

// 7. Reports, then back to the Panel
await go("/app/reportes", "text=Autonomía");
await pause(4500);
await go("/app", "text=Resumen ejecutivo");
await pause(3500);

await ctx.close();
await browser.close();
const file = readdirSync(outDir).find((f) => f.endsWith(".webm"));
if (file) renameSync(`${outDir}/${file}`, `${outDir}/orbit-demo.webm`);
console.log("recorded", `${outDir}/orbit-demo.webm`);

// Records the core demo flow as a video (webm) against a running dev server, using the demo session.
// usage: CHROME_PATH=... node scripts/record-demo.mjs [out dir = docs/demo]
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const outDir = process.argv[2] ?? "docs/demo";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: outDir, size: { width: 1440, height: 900 } } });
await ctx.addCookies([{ name: "orbit_session", value: "demo", url: base }]);
const page = await ctx.newPage();
const pause = (ms) => page.waitForTimeout(ms);
const go = async (path, wait) => { await page.goto(base + path, { waitUntil: "load" }); if (wait) await page.waitForSelector(wait, { timeout: 30000 }); };

// Fresh company
await fetch(`${base}/api/reset`, { method: "POST" });

// 0. Landing
await go("/", "text=Actúa con autonomía");
await pause(2500);
await page.mouse.wheel(0, 700);
await pause(2000);

// 1. Rules, then agents
await go("/app/reglas", "text=Límites");
await pause(3000);
await go("/app/configuracion", "text=Agentes");
await pause(3500);

// 2. A case by vendor + contract, and the vendor's link
await go("/app/facturas", "text=Set de demo");
await page.click("text=Nuevo caso");
await page.waitForSelector("text=Nuevo caso de pago");
await page.selectOption("select >> nth=0", { label: (await page.$$eval("select >> nth=0 >> option", (os) => os.map((o) => o.textContent))).find((t) => t.includes("Lucía")) });
await pause(1200);
await page.click("text=Abrir caso y crear enlace");
await page.waitForSelector("text=Enlace para el proveedor");
await pause(2000);
const link = await page.$eval("code", (el) => el.textContent);
await page.goto(link, { waitUntil: "load" });
await page.waitForSelector("text=Adjunta la factura");
await pause(3000);

// 3. Run the demo set and watch the board fill
await go("/app/facturas", "text=Set de demo");
await page.click("text=Correr set de demo");
await page.waitForSelector("text=Set de demo completo", { timeout: 300000 });
await pause(1500);
// Open Lucía's EUR case
await page.click("text=Lucía Fernández >> nth=0");
await page.waitForSelector("text=Negociación con el proveedor");
await pause(1500);
await page.mouse.wheel(0, 500);
await pause(3500);
// The vendor's view of the same case
const caseLink = await page.$eval("aside code", (el) => el.textContent);
await page.goto(caseLink, { waitUntil: "load" });
await page.waitForSelector("text=Conversación");
await pause(4000);
await page.mouse.wheel(0, 600);
await pause(2500);

// 4. Approvals
await go("/app/aprobaciones", "text=Aprobaciones");
await pause(3000);
await page.click("text=Aprobar pago >> nth=0").catch(() => {});
await pause(2500);

// 5. Reports and panel
await go("/app/reportes", "text=Autonomía");
await pause(4000);
await go("/app", "text=Resumen ejecutivo");
await pause(3000);

await ctx.close();
await browser.close();
const file = readdirSync(outDir).find((f) => f.endsWith(".webm"));
if (file) renameSync(`${outDir}/${file}`, `${outDir}/orbit-demo.webm`);
console.log("recorded", `${outDir}/orbit-demo.webm`);

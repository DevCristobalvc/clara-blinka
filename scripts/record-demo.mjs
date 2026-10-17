// Records the demo as a video (webm) against a running server, following the narrative in docs/pitch.md:
// landing → login → Panel (invoices to pay) → the pagador is hired and funded with REAL x402 payments
// (scripts/x402-pay.mjs, test wallet) while the Panel is on screen → rules → "Pon a ORBIT a trabajar"
// → the board fills → Lucía's negotiation → the vendor's view → approvals → reports → Panel.
// usage: CHROME_PATH=... node --env-file=.env --env-file=.env.local scripts/record-demo.mjs [out dir = docs/demo]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const outDir = process.argv[2] ?? "docs/demo";
mkdirSync(outDir, { recursive: true });
const canPay = Boolean(process.env.ORBIT_TEST_PAYER_PRIVATE_KEY);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: outDir, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const t0 = Date.now();
const pause = (ms) => page.waitForTimeout(ms);
// Narration clips (docs/demo/voice/block-N.mp3) set how long each screen segment must last; the timeline
// of where each block starts on screen is written for scripts/narrate.mjs.
const clipLen = (n) => { const f = `${outDir}/voice/block-${n}.mp3`; return existsSync(f) ? Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) : 0; };
const timeline = [];
let segStart = 0;
const block = (n) => { segStart = (Date.now() - t0) / 1000; timeline.push({ block: n, at: Number(segStart.toFixed(2)) }); };
/** Wait until the current block has been on screen at least as long as its narration (plus a beat). */
const holdFor = async (n, minMs = 0) => { const need = Math.max(minMs, clipLen(n) * 1000 + 800) - ((Date.now() - t0) / 1000 - segStart) * 1000; if (need > 0) await pause(need); };
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
for (const p of ["/", "/login", "/deck", "/app", "/app/facturas", "/app/reglas", "/app/aprobaciones", "/app/reportes"]) await fetch(base + p, { headers: { cookie: "orbit_session=demo" } }).catch(() => {});

// 0. Title and the problem (deck)
block(0);
await go("/deck?s=0", "text=Reto Blinka");
await pause(7000);
await go("/deck?s=1", "text=El problema");
await holdFor(0, 14000);
// 1. The team, then what we built (deck)
block(1);
await go("/deck?s=2", "text=El equipo");
await pause(12000);
await go("/deck?s=3", "text=Qué construimos");
await holdFor(1, 8000);

// 2. You are in your account: login, then the Panel with the invoices to pay
block(2);
await go("/login", "text=Iniciar sesión");
await pause(3000);
await ctx.addCookies([{ name: "orbit_session", value: "demo", url: base }]);
await go("/app", "text=facturas por pagar");
await holdFor(2, 6000);

// 3. Hire the pagador and fund it: real x402 payments from the test wallet while the Panel is on screen
block(3);
if (canPay) {
  pay("activate");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("text=activo desde", { timeout: 60000 });
  await pause(3000);
  pay("fund");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("text=USDC en su wallet", { timeout: 60000 });
  await holdFor(3, 3000);
} else {
  console.warn("ORBIT_TEST_PAYER_PRIVATE_KEY not set: skipping the real activation; the Panel stays on step 1");
  await holdFor(3, 4000);
}

// 4. Rules
block(4);
await go("/app/reglas", "text=Límites");
await pause(5000);
await page.mouse.wheel(0, 500);
await holdFor(4, 4000);

// 5. Put it to work: from the Panel, then watch the board
block(5);
await go("/app", "text=Pon a ORBIT a trabajar");
await pause(1500);
await page.click("text=Pon a ORBIT a trabajar");
// The invoices are processed by the browser; stay on the Panel while the counters move, then navigate
// client-side (sidebar link) so the loop keeps running, and watch the board fill.
await pause(16000);
await page.click("aside >> text=Facturas");
await page.waitForSelector("text=Set de demo completo", { timeout: 420000 });
await holdFor(5, 2500);

// 6. Lucía's negotiation, then the vendor's view
block(6);
await page.click("text=Lucía Fernández >> nth=0");
await page.waitForSelector("text=Negociación con el proveedor");
await pause(1500);
await page.mouse.wheel(0, 500);
await pause(4000);
const caseLink = await page.$eval("aside code", (el) => el.textContent);
await page.goto(caseLink, { waitUntil: "load" });
await page.waitForSelector("text=Conversación");
await pause(4000);
await page.mouse.wheel(0, 600);
await holdFor(6, 4000);

// 7. Approvals
block(7);
await go("/app/aprobaciones", "text=Aprobaciones");
await pause(4000);
await page.click("text=Aprobar pago >> nth=0").catch(() => {});
await holdFor(7, 3000);

// 8. Reports, then results and what's next (deck)
block(8);
await go("/app/reportes", "text=Autonomía");
await pause(6000);
await go("/deck?s=4", "text=Resultados");
await pause(8000);
await go("/deck?s=5", "text=Qué sigue");
await holdFor(8, 8000);
await pause(1500);
writeFileSync(`${outDir}/timeline.json`, JSON.stringify(timeline));

await ctx.close();
await browser.close();
const file = readdirSync(outDir).find((f) => f.endsWith(".webm"));
if (file) renameSync(`${outDir}/${file}`, `${outDir}/orbit-demo.webm`);
console.log("recorded", `${outDir}/orbit-demo.webm`);

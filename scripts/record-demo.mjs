// Records the demo as a 1080p video against a running server, following the narrative in docs/pitch.md:
// deck (problem, team, what we built) → login → Panel (account bar, Depositar, invoices to pay) → the pagador
// is hired and funded with REAL x402 payments → rules → "Pon a ORBIT a trabajar" → the board fills and vendors
// get paid on-chain → Lucía's negotiation → the vendor's view with the payout and its transaction → approvals →
// reports → results (deck). Writes docs/demo/timeline.json (block starts + zoom-ins) for scripts/narrate.mjs.
// usage: CHROME_PATH=... node --env-file=.env.local scripts/record-demo.mjs [out dir = docs/demo] [--live]
//   --live: visible Chrome with a persistent profile; you sign in with Privy on camera and the payments are made
//   by clicking the wizard with your wallet (the test-wallet script is the fallback).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

const live = process.argv.includes("--live");
const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const outDir = process.argv.filter((a) => !a.startsWith("--"))[2] ?? "docs/demo";
mkdirSync(outDir, { recursive: true });
const canPay = Boolean(process.env.ORBIT_TEST_PAYER_PRIVATE_KEY);
const executablePath = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
// Laid out at 1280×720 and rendered at 2x into a 1920×1080 video: every UI text is 1.5x larger than at 1440.
const viewport = { width: 1280, height: 720 };
const video = { width: 1920, height: 1080 };
const SCALE = video.width / viewport.width;

const ctxOpts = { viewport, deviceScaleFactor: 2, recordVideo: { dir: outDir, size: video } };
const ctx = live
  ? await chromium.launchPersistentContext(".playwright-profile", { headless: false, executablePath, ...ctxOpts, args: [`--window-size=${viewport.width},${viewport.height + 90}`] })
  : await (await chromium.launch({ executablePath })).newContext(ctxOpts);
const page = ctx.pages()[0] ?? (await ctx.newPage());
const t0 = Date.now();
const now = () => (Date.now() - t0) / 1000;
const pause = (ms) => page.waitForTimeout(ms);

// A visible cursor with a click pulse, and smooth moves before every click.
await ctx.addInitScript(() => {
  const dot = document.createElement("div");
  dot.id = "__orbit_cursor";
  dot.style.cssText = "position:fixed;z-index:2147483647;width:20px;height:20px;border-radius:50%;background:#f5e400;box-shadow:0 0 0 3px rgba(0,0,0,.65),0 0 16px rgba(245,228,0,.9);pointer-events:none;transform:translate(-50%,-50%);left:-50px;top:-50px;transition:transform .08s";
  const mount = () => document.body && document.body.appendChild(dot);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
  window.addEventListener("mousemove", (e) => { dot.style.left = `${e.clientX}px`; dot.style.top = `${e.clientY}px`; }, true);
  window.addEventListener("mousedown", (e) => {
    dot.style.transform = "translate(-50%,-50%) scale(.7)";
    const ring = document.createElement("div");
    ring.style.cssText = `position:fixed;z-index:2147483646;left:${e.clientX}px;top:${e.clientY}px;width:20px;height:20px;border-radius:50%;border:3px solid #f5e400;pointer-events:none;transform:translate(-50%,-50%);opacity:.9;transition:transform .55s ease-out,opacity .55s ease-out`;
    document.body.appendChild(ring);
    requestAnimationFrame(() => { ring.style.transform = "translate(-50%,-50%) scale(4)"; ring.style.opacity = "0"; });
    setTimeout(() => ring.remove(), 600);
  }, true);
  window.addEventListener("mouseup", () => { dot.style.transform = "translate(-50%,-50%) scale(1)"; }, true);
});
const click = async (selector, opts = {}) => {
  const el = page.locator(selector).first();
  await el.waitFor({ timeout: opts.timeout ?? 30000 });
  const box = await el.boundingBox();
  if (box) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 28 });
  await pause(350);
  await el.click();
};

// Timeline for the editor: where each narration block starts, and zoom-ins on the moments that matter.
const clipLen = (n) => { const f = `${outDir}/voice/block-${n}.mp3`; return existsSync(f) ? Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString()) : 0; };
const timeline = { blocks: [], zooms: [] };
let segStart = 0;
const block = (n) => { segStart = now(); timeline.blocks.push({ block: n, at: Number(segStart.toFixed(2)) }); };
/** Wait until the current block has been on screen at least as long as its narration (plus a beat). */
const holdFor = async (n, minMs = 0) => { const need = Math.max(minMs, clipLen(n) * 1000 + 800) - (now() - segStart) * 1000; if (need > 0) await pause(need); };
/** Zoom the final video on an element (or a viewport box) for `ms`, and keep the screen still meanwhile. */
const zoomOn = async (target, { z = 1.6, ms = 4000, dy = 0, dx = 0 } = {}) => {
  let box = typeof target === "string" ? await page.locator(target).first().boundingBox().catch(() => null) : target;
  if (!box) { await pause(ms); return; }
  const cx = Math.min(Math.max((box.x + box.width / 2 + dx) * SCALE, 0), video.width);
  const cy = Math.min(Math.max((box.y + box.height / 2 + dy) * SCALE, 0), video.height);
  timeline.zooms.push({ from: Number(now().toFixed(2)), to: Number((now() + ms / 1000).toFixed(2)), cx: Math.round(cx), cy: Math.round(cy), z });
  await pause(ms);
};
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
await pause(5000);
await go("/deck?s=1", "text=El problema");
await holdFor(0, 9000);
// 1. The team, then what we built (deck)
block(1);
await go("/deck?s=2", "text=El equipo");
await pause(8000);
await go("/deck?s=3", "text=Qué construimos");
await holdFor(1, 6000);

// 2. You are in your account: login, then the Panel (account bar with balance and Depositar, wizard step 1)
block(2);
if (live) {
  await go("/login");
  await page.bringToFront();
  console.log("\n>>> Sign in with Privy in the Chrome window now (email, Google or passkey). Waiting up to 10 minutes…\n");
  await page.waitForURL(/\/app(\/|$|\?)/, { timeout: 600000 });
  await page.waitForSelector("text=Configura a ORBIT", { timeout: 60000 });
  await page.waitForSelector("text=USDC", { timeout: 60000 }).catch(() => {});
} else {
  await go("/login", "text=Iniciar sesión");
  await pause(3000);
  await ctx.addCookies([{ name: "orbit_session", value: "demo", url: base }]);
  await go("/app", "text=Configura a ORBIT");
}
await pause(1500);
// The account bar shows Depositar only with a Privy wallet (the live take); the demo session has none.
if (await page.locator('button:has-text("Depositar")').count()) {
  await zoomOn('button:has-text("Depositar")', { z: 1.5, ms: 2500, dx: -260 });
  await click('button:has-text("Depositar")');
  await zoomOn("text=Depositar USDC", { z: 1.4, ms: 3500, dy: 140 });
  await click('button[aria-label="Cerrar"]');
} else {
  await zoomOn("text=Configura a ORBIT", { z: 1.3, ms: 4000, dy: 120, dx: 200 });
}
await holdFor(2, 2000);

// 3. Hire the pagador and fund it: real x402 payments while the wizard is on screen; zoom on each confirmation
block(3);
const payByClick = async (buttonText, nextHeader) => {
  await click(`button:has-text("${buttonText}")`);
  try {
    await page.waitForSelector(`h2:has-text('${nextHeader}')`, { timeout: 90000 });
    return true;
  } catch {
    console.warn(`${buttonText}: no confirmation in 90 s`);
    return false;
  }
};
const confirmations = async (ms) => { await pause(600); await zoomOn("text=Confirmaciones", { z: 1.5, ms, dy: 90 }); };
if (live && (await page.locator('button:has-text("Contratar por")').count())) {
  if (!(await payByClick("Contratar por", "Cárgale fondos")) && canPay) { pay("activate"); await page.reload({ waitUntil: "load" }); await page.waitForSelector("h2:has-text('Cárgale fondos')", { timeout: 60000 }); }
  await confirmations(3500);
  if (!(await payByClick("Cargar $", "Sus reglas")) && canPay) { pay("fund"); await page.reload({ waitUntil: "load" }); await page.waitForSelector("h2:has-text('Sus reglas')", { timeout: 60000 }); }
  await confirmations(4000);
  await holdFor(3, 2000);
} else if (canPay) {
  pay("activate");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("h2:has-text('Cárgale fondos')", { timeout: 60000 });
  await confirmations(3500);
  pay("fund");
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("h2:has-text('Sus reglas')", { timeout: 60000 });
  await confirmations(4000);
  await holdFor(3, 2000);
} else {
  console.warn("ORBIT_TEST_PAYER_PRIVATE_KEY not set: skipping the real activation; the wizard stays on step 1");
  await holdFor(3, 4000);
}

// 4. Rules: wizard step 3, then continue
block(4);
await pause(800);
await zoomOn("h2:has-text('Sus reglas')", { z: 1.35, ms: 6000, dy: 150, dx: 120 });
await holdFor(4, 2000);
await click("text=Continuar");
await pause(1500);

// 5. Put it to work: wizard step 4 navigates to Facturas and processes the invoices in the browser
block(5);
await click("text=Pon a ORBIT a trabajar");
await page.waitForSelector("text=Set de demo completo", { timeout: 600000 });
await pause(1000);
await zoomOn("text=Pagadas", { z: 1.6, ms: 5000, dy: 170, dx: 100 });
await holdFor(5, 1500);

// 6. Lucía's negotiation, then the vendor's view with the payout and its transaction
block(6);
await click("text=Lucía Fernández");
await page.waitForSelector("text=Negociación con el proveedor");
await pause(1200);
await page.locator("text=Negociación con el proveedor").first().scrollIntoViewIfNeeded().catch(() => {});
await pause(600);
await zoomOn("text=Negociación con el proveedor", { z: 1.45, ms: 7000, dy: 200 });
await pause(1500);
const caseLink = await page.$eval("aside code", (el) => el.textContent);
await page.goto(caseLink, { waitUntil: "load" });
await page.waitForSelector("text=Conversación");
await pause(2000);
await page.locator("text=Pago enviado").first().scrollIntoViewIfNeeded().catch(() => {});
await pause(800);
await zoomOn("text=Pago enviado", { z: 1.6, ms: 5000, dy: 40 });
// The transaction link itself (BaseScan is behind a bot check, so we don't open it on camera).
await zoomOn('a[href*="basescan.org/tx/"]', { z: 2.2, ms: 3500 });
await holdFor(6, 1000);

// 7. Approvals
block(7);
await go("/app/aprobaciones", "text=Aprobaciones");
await pause(2500);
await click("text=Aprobar pago").catch(() => {});
await pause(800);
await zoomOn("main >> text=Aprobaciones", { z: 1.4, ms: 4500, dy: 190, dx: 300 });
await holdFor(7, 1500);

// 8. Reports, then results and what's next (deck)
block(8);
await go("/app/reportes", "text=Autonomía");
await pause(1000);
await zoomOn("text=Autonomía", { z: 1.45, ms: 4500, dx: 260, dy: 20 });
await go("/deck?s=4", "text=Resultados");
await pause(7000);
await go("/deck?s=5", "text=Qué sigue");
await holdFor(8, 7000);
await pause(1500);
writeFileSync(`${outDir}/timeline.json`, JSON.stringify(timeline));

await ctx.close();
if (!live) await ctx.browser()?.close();
const file = readdirSync(outDir).find((f) => f.endsWith(".webm"));
if (file) renameSync(`${outDir}/${file}`, `${outDir}/orbit-demo.webm`);
console.log("recorded", `${outDir}/orbit-demo.webm`, `zooms: ${timeline.zooms.length}`);

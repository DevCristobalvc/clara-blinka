import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" });
for (const path of ["/login", "/app"]) {
  const page = await browser.newPage();
  let connects = 0; const msgs = [];
  page.on("console", (m) => { if (m.text().includes("[HMR] connected")) connects++; if (m.type()==="error"||m.type()==="warning") msgs.push(m.text().slice(0,200)); });
  page.on("framenavigated", (f) => { if (f === page.mainFrame()) msgs.push("NAV " + f.url()); });
  await page.goto("http://localhost:3000" + path, { waitUntil: "load" });
  await page.waitForTimeout(4000);
  console.log(path, "HMR connects:", connects, msgs.slice(0, 6));
  await page.close();
}
await browser.close();

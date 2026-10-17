// Copy the demo invoices into public/ so the UI can link to the original documents.
import { cpSync, existsSync, rmSync } from "node:fs";

const from = "data/invoices";
const to = "public/invoices";
if (existsSync(from)) {
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`synced ${from} -> ${to}`);
}

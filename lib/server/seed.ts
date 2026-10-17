import { readFileSync } from "node:fs";
import path from "node:path";
import type { Company } from "@/lib/engine/types";
import type { CaseStore } from "./store";

export const DEMO_COMPANY_ID = "andes";

interface SeedFile extends Company {
  asOf?: string;
}

function readSeed(): SeedFile {
  return JSON.parse(readFileSync(path.join(process.cwd(), "data", "company.json"), "utf8")) as SeedFile;
}

/** The fictitious demo company, as stored (id + empty webhook config). */
export function seedCompany(): Company {
  const company: SeedFile = { ...readSeed(), id: DEMO_COMPANY_ID };
  delete company.asOf;
  return { ...company, webhook: company.webhook ?? {} };
}

/** The dataset's "today": its invoices are dated around it, so cases are decided as of this date. */
export function demoToday(): string {
  return readSeed().asOf ?? new Date().toISOString().slice(0, 10);
}

export async function ensureCompany(store: CaseStore, companyId = DEMO_COMPANY_ID): Promise<Company> {
  const existing = await store.getCompany(companyId);
  if (existing) return existing;
  const company = seedCompany();
  await store.putCompany(company);
  return company;
}

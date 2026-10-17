import { promises as fs } from "node:fs";
import path from "node:path";
import type { Sample } from "@/components/Inbox";
import type { Expected } from "@/lib/client/store";
import type { Company, Invoice } from "@/lib/engine/types";

const DATA = path.join(process.cwd(), "data");

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
  } catch {
    return undefined;
  }
}

const EMPTY_COMPANY: Company = {
  company: { name: "Empresa demo", country: "US", baseCurrency: "USD" },
  policy: {
    perPaymentLimitUSD: 8000,
    humanApprovalAboveUSD: 2000,
    monthlyBudgetUSD: { contractor_services: 20000, software: 3000, office: 4000, marketing: 5000, legal_accounting: 3000, travel: 2000, other: 1000 },
    allowedCurrencies: ["USD", "COP", "MXN", "BRL", "ARS"],
    maxDaysUntilDue: 30,
    duplicateWindowDays: 20,
  },
  beneficiaries: [],
  contracts: [],
  history: [],
};

/** Demo dataset (fictitious company). Read at build time, so it ships inside the static page. */
export async function loadDataset(): Promise<{ company: Company; samples: Sample[]; today: string }> {
  "use cache";
  const company = (await readJson<Company & { asOf?: string }>("company.json")) ?? EMPTY_COMPANY;
  const invoices = (await readJson<{ file: string; invoice: Invoice }[]>("invoices.json")) ?? [];
  const expected = (await readJson<Expected[]>("expected.json")) ?? [];
  const byFile = new Map(expected.map((e) => [e.file, e]));
  const samples: Sample[] = invoices.map(({ file, invoice }) => ({
    file,
    invoice,
    expected: byFile.get(file),
    url: `/${file.replace(/^\/+/, "")}`,
  }));
  const { asOf, ...rest } = company as Company & { asOf?: string };
  return { company: rest, samples, today: asOf ?? "2026-10-17" };
}

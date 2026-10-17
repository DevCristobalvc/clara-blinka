import { promises as fs } from "node:fs";
import path from "node:path";
import type { SampleRow } from "@/components/app/Workspace";
import type { Company, Expected, Invoice } from "@/lib/engine/types";

const DATA = path.join(process.cwd(), "data");

async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
  } catch {
    return undefined;
  }
}

/** Demo dataset (fictitious company). Read at build time, so it ships inside the static page. */
export async function loadDataset(): Promise<{ company: Company | undefined; samples: SampleRow[]; today: string }> {
  "use cache";
  const company = await readJson<Company & { asOf?: string }>("company.json");
  const invoices = (await readJson<{ file: string; invoice: Invoice }[]>("invoices.json")) ?? [];
  const expected = (await readJson<Expected[]>("expected.json")) ?? [];
  const byFile = new Map(expected.map((e) => [e.file, e]));
  const samples: SampleRow[] = invoices.map(({ file, invoice }) => ({
    file,
    invoice,
    expected: byFile.get(file),
    url: `/${file.replace(/^\/+/, "")}`,
  }));
  return { company, samples, today: company?.asOf ?? "2026-10-17" };
}

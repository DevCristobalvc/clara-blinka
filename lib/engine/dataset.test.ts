import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decide } from "./decide";
import { judge, judgeOffline } from "./jev";
import { toPaymentRecord } from "./ledger";
import type { Action, Company, Invoice, PaymentRecord, ReasonCode } from "./types";

const read = <T,>(f: string): T => JSON.parse(readFileSync(`data/${f}`, "utf8")) as T;
const { asOf, ...company } = read<Company & { asOf: string }>("company.json");
const invoices = read<{ file: string; invoice: Invoice }[]>("invoices.json");
const expected = new Map(read<{ file: string; expectedAction: Action; reasonCodes: ReasonCode[] }[]>("expected.json").map((e) => [e.file, e]));

// Live JEV only when explicitly requested, so CI stays deterministic.
const live = process.env.CLARA_EVAL_LIVE === "1" && !!process.env.TYPESAFE_API_KEY;

describe(`dataset eval (${live ? "live JEV" : "offline judge"})`, () => {
  it("decides the demo set with zero unsafe payments", async () => {
    const ledger: PaymentRecord[] = [];
    const rows: string[] = [];
    let correct = 0;
    let autonomous = 0;
    let unsafe = 0;
    for (const { file, invoice } of invoices) {
      const d = await decide(invoice, company, { today: asOf, extraHistory: ledger, judge: live ? (i) => judge(i) : async (i) => judgeOffline(i) });
      const exp = expected.get(file)!;
      if (d.action === "PAY") {
        const record = toPaymentRecord(d, asOf);
        if (record) ledger.push(record);
      }
      const ok = d.action === exp.expectedAction;
      if (ok) correct++;
      if (ok && d.action !== "ESCALATE") autonomous++;
      if (d.action === "PAY" && exp.expectedAction !== "PAY") unsafe++;
      const missing = exp.reasonCodes.filter((c) => !d.reasons.includes(c));
      rows.push(`| ${file.replace("invoices/", "")} | ${exp.expectedAction} | ${d.action} ${ok ? "✅" : "❌"} | ${d.reasons.join(", ") || "-"} | ${missing.join(", ") || "-"} |`);
    }
    const n = invoices.length;
    const pct = (x: number) => `${Math.round((x / n) * 100)}%`;
    const report = [
      `# Clara eval (${live ? "live JEV" : "offline judge"})`,
      "",
      `Dataset: ${n} fictitious invoices, as of ${asOf}.`,
      "",
      `- **Accuracy:** ${correct}/${n} (${pct(correct)})`,
      `- **Autonomy** (correct without a human): ${autonomous}/${n} (${pct(autonomous)})`,
      `- **Safety** (payments approved outside the rules): **${unsafe}**`,
      "",
      "| Invoice | Expected | Clara | Reasons | Missing expected reasons |",
      "|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n");
    mkdirSync("docs", { recursive: true });
    writeFileSync(`docs/eval${live ? "-live" : ""}.md`, report);
    console.log(report);

    expect(unsafe).toBe(0);
    expect(correct).toBe(n);
  });
});

import { describe, expect, it } from "vitest";
import { decide } from "./decide";
import { judgeOffline } from "./jev";
import type { Company, Invoice, JevAnswers } from "./types";

const TODAY = "2026-10-17";

const company: Company = {
  company: { name: "Test Co", country: "US", baseCurrency: "USD" },
  policy: {
    perPaymentLimitUSD: 8000,
    humanApprovalAboveUSD: 2000,
    monthlyBudgetUSD: { contractor_services: 10000, software: 1000 },
    allowedCurrencies: ["USD", "COP", "MXN", "BRL"],
    maxDaysUntilDue: 30,
    duplicateWindowDays: 20,
  },
  beneficiaries: [
    { id: "b1", name: "Laura Gómez", country: "CO", currency: "COP", account: { type: "bank", value: "BANCOLOMBIA-123-456" }, category: "contractor_services" },
    { id: "b2", name: "Nube SaaS Inc.", country: "US", currency: "USD", account: { type: "bank", value: "US-999" }, category: "software" },
  ],
  contracts: [
    { id: "c1", beneficiaryId: "b1", concept: "Desarrollo frontend mensual", amount: 6000000, currency: "COP", tolerancePct: 5, frequency: "monthly" },
    { id: "c2", beneficiaryId: "b2", concept: "Suscripción plataforma analítica", amount: 300, currency: "USD", tolerancePct: 0, frequency: "monthly" },
  ],
  history: [
    { invoiceNumber: "NB-0901", beneficiaryId: "b2", amount: 300, currency: "USD", paidAt: "2026-10-01", category: "software" },
  ],
};

const base: Invoice = {
  payeeName: "Laura Gomez",
  payeeAccount: "BANCOLOMBIA 123 456",
  invoiceNumber: "LG-010",
  issueDate: "2026-10-15",
  dueDate: "2026-10-30",
  currency: "COP",
  amount: 6000000,
  concept: "Desarrollo frontend octubre",
};

const quiet = async (): Promise<JevAnswers> => ({ source: "offline", latencyMs: 0, socialEngineering: 0.05, conceptMatchesContract: 0.9, risk: { score: "low", confidence: 0.9 } });
const run = (inv: Partial<Invoice>, c: Company = company) => decide({ ...base, ...inv }, c, { today: TODAY, judge: quiet });

describe("decide", () => {
  it("pays a clean invoice within all rules", async () => {
    const d = await run({});
    expect(d.action).toBe("PAY");
    expect(d.reasons).toEqual([]);
    expect(d.amountUSD).toBe(1500);
  });

  it("escalates a beneficiary that is not allowlisted", async () => {
    const d = await run({ payeeName: "Nuevo Proveedor SAS", payeeAccount: "X-1" });
    expect(d.action).toBe("ESCALATE");
    expect(d.reasons).toContain("NOT_ALLOWLISTED");
  });

  it("holds when the bank account differs from the one on file", async () => {
    const d = await run({ payeeAccount: "NEQUI-777" });
    expect(d.action).toBe("HOLD");
    expect(d.reasons).toContain("BANK_DETAILS_CHANGED");
  });

  it("holds a duplicate by invoice number", async () => {
    const d = await run({ payeeName: "Nube SaaS Inc", payeeAccount: undefined, invoiceNumber: "NB-0901", currency: "USD", amount: 300, concept: "Suscripción plataforma analítica" });
    expect(d.action).toBe("HOLD");
    expect(d.reasons).toContain("DUPLICATE");
  });

  it("holds a duplicate by same amount inside the window", async () => {
    const d = await run({ payeeName: "Nube SaaS", payeeAccount: "US-999", invoiceNumber: "NB-0902", currency: "USD", amount: 300, issueDate: "2026-10-10", concept: "Suscripción plataforma analítica" });
    expect(d.reasons).toContain("DUPLICATE");
  });

  it("holds an amount outside the contract tolerance", async () => {
    const d = await run({ amount: 6600000 });
    expect(d.action).toBe("HOLD");
    expect(d.reasons).toContain("CONTRACT_MISMATCH");
  });

  it("holds when the currency differs from the contract", async () => {
    const d = await run({ currency: "USD", amount: 1500 });
    expect(d.reasons).toContain("CONTRACT_MISMATCH");
  });

  it("escalates above the human approval threshold", async () => {
    const c = { ...company, contracts: [] };
    const d = await run({ amount: 10000000 }, c); // 2,500 USD
    expect(d.action).toBe("ESCALATE");
    expect(d.reasons).toEqual(["NEEDS_HUMAN_APPROVAL"]);
  });

  it("flags over the per-payment limit", async () => {
    const c = { ...company, contracts: [] };
    const d = await run({ amount: 40000000 }, c); // 10,000 USD
    expect(d.reasons).toContain("OVER_PER_PAYMENT_LIMIT");
  });

  it("escalates when the monthly budget would be exceeded", async () => {
    const c: Company = {
      ...company,
      history: [...company.history, { invoiceNumber: "OLD-1", beneficiaryId: "b1", amount: 36000000, currency: "COP", paidAt: "2026-10-02", category: "contractor_services" }],
    };
    const d = await run({}, c); // 9,000 + 1,500 > 10,000
    expect(d.action).toBe("ESCALATE");
    expect(d.reasons).toContain("BUDGET_EXCEEDED");
  });

  it("ignores last month's spend for the budget", async () => {
    const c: Company = {
      ...company,
      history: [{ invoiceNumber: "OLD-1", beneficiaryId: "b1", amount: 36000000, currency: "COP", paidAt: "2026-09-02", category: "contractor_services" }],
    };
    expect((await run({}, c)).action).toBe("PAY");
  });

  it("holds a currency that is not allowed", async () => {
    const d = await run({ currency: "EUR" });
    expect(d.action).toBe("HOLD");
    expect(d.reasons).toContain("CURRENCY_NOT_ALLOWED");
  });

  it("escalates past-due and holds too-early invoices", async () => {
    expect((await run({ dueDate: "2026-10-01" })).reasons).toContain("PAST_DUE");
    expect((await run({ dueDate: "2027-01-30" })).reasons).toContain("DUE_TOO_FAR");
  });

  it("holds when JEV sees social engineering", async () => {
    const d = await decide({ ...base, rawText: "URGENTE: cambiamos de banco, paga hoy mismo a la nueva cuenta" }, company, { today: TODAY, judge: async (i) => judgeOffline(i) });
    expect(d.action).toBe("HOLD");
    expect(d.reasons).toContain("SUSPICIOUS");
  });

  it("escalates when JEV is not confident the concept matches the contract", async () => {
    const d = await decide(base, company, { today: TODAY, judge: async () => ({ ...(await quiet()), conceptMatchesContract: 0.2 }) });
    expect(d.action).toBe("ESCALATE");
    expect(d.reasons).toContain("LOW_CONFIDENCE");
  });

  it("explains every decision in plain language", async () => {
    const d = await run({ payeeAccount: "NEQUI-777" });
    expect(d.explanation).toMatch(/Frenada/);
    expect(d.explanation).toMatch(/no coincide con la registrada/);
  });
});

describe("safety invariant", () => {
  it("never pays when any check fails (randomized)", async () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    for (let i = 0; i < 500; i++) {
      const inv: Invoice = {
        payeeName: pick(["Laura Gómez", "Nube SaaS Inc.", "Random Vendor LLC"]),
        payeeAccount: pick([undefined, "BANCOLOMBIA-123-456", "US-999", "OTHER-1"]),
        invoiceNumber: pick(["LG-010", "NB-0901", `X-${i}`]),
        issueDate: "2026-10-10",
        dueDate: pick(["2026-09-30", "2026-10-25", "2027-03-01"]),
        currency: pick(["USD", "COP", "EUR", "BRL"]),
        amount: Math.round(rnd() * 50000000),
        concept: pick(["Desarrollo frontend", "Suscripción plataforma analítica", "Consultoría"]),
      };
      const jev: JevAnswers = { source: "offline", latencyMs: 0, socialEngineering: rnd(), conceptMatchesContract: rnd(), risk: { score: pick(["low", "medium", "high"]), confidence: rnd() } };
      const d = await decide(inv, company, { today: TODAY, judge: async () => jev });
      const failed = d.rules.filter((r) => !r.pass);
      if (d.action === "PAY") expect(failed).toEqual([]);
      else expect(d.reasons.length).toBeGreaterThan(0);
    }
  });
});

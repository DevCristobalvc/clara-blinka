import { describe, expect, it } from "vitest";
import { MockExecutor } from "@/lib/engine/executor";
import { templateProse } from "@/lib/engine/negotiate";
import { verifyReceipt } from "@/lib/engine/receipt";
import type { Company, Invoice, JevAnswers } from "@/lib/engine/types";
import { createCase, HttpError, ledger, postVendorReply, publicCase, reviewCase, submitInvoice, type CaseDeps } from "./cases";
import { ConflictError, MemoryStore } from "./store";
import { emitWebhook, verifyWebhook, webhookTypeFor } from "./webhooks";

const TODAY = "2026-10-17";

const company: Company = {
  id: "test",
  company: { name: "Test Co", country: "US", baseCurrency: "USD" },
  webhook: {},
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
  history: [{ invoiceNumber: "NB-0901", beneficiaryId: "b2", amount: 300, currency: "USD", paidAt: "2026-10-01", category: "software" }],
};

const laura: Invoice = {
  payeeName: "Laura Gomez",
  payeeAccount: "BANCOLOMBIA 123 456",
  invoiceNumber: "LG-010",
  issueDate: "2026-10-15",
  dueDate: "2026-10-30",
  currency: "COP",
  amount: 6600000, // 10% over a 5% tolerance → HOLD, negotiable
  concept: "Desarrollo frontend octubre",
};

const quiet = async (): Promise<JevAnswers> => ({ source: "offline", latencyMs: 0, socialEngineering: 0.05, conceptMatchesContract: 0.9, risk: { score: "low", confidence: 0.9 } });

async function setup() {
  const store = new MemoryStore();
  await store.putCompany(company);
  const deps: CaseDeps = { store, today: TODAY, prose: templateProse, judge: quiet, executor: new MockExecutor() };
  return { store, deps };
}

describe("case service", () => {
  it("runs a case end to end: link → invoice → negotiation → corrected → paid, with receipt and one ledger entry", async () => {
    const { store, deps } = await setup();
    const created = await createCase(deps, "test", { vendorHint: { name: "Laura Gómez" } });
    expect(created.status).toBe("awaiting_invoice");

    const held = await submitInvoice(deps, "test", created.id, laura);
    expect(held.status).toBe("negotiating");
    expect(held.decision?.action).toBe("HOLD");
    expect(held.thread?.pendingRequest?.type).toBe("reissue_at_contract_amount");
    expect(held.receipt && verifyReceipt(held.receipt)).toBe(true);
    expect(held.version).toBe(2);
    expect(await ledger(store, "test")).toEqual([]);

    const paid = await postVendorReply(deps, "test", created.id, { kind: "reissue", invoice: { amount: 6000000, invoiceNumber: "LG-010-R" } });
    expect(paid.status).toBe("paid");
    expect(paid.thread?.outcome).toBe("auto_resolved");
    expect(paid.decision?.supersededBy).toBe(paid.thread?.finalDecision?.id);
    expect(paid.settlement?.ref).toMatch(/^pago-/);
    expect(paid.receipt?.payload).toMatchObject({ action: "PAY", amount: 6000000, invoiceNumber: "LG-010-R" });
    expect(verifyReceipt(paid.receipt!)).toBe(true);

    const records = await ledger(store, "test");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ invoiceNumber: "LG-010-R", amount: 6000000, beneficiaryId: "b1" });

    const events = await store.listEvents("test", { caseId: created.id });
    expect(events.map((e) => e.type)).toEqual(["case.created", "invoice.submitted", "decision", "orbit.message", "vendor.message", "correction.decided", "settlement"]);
    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(events.filter((e) => e.receipt).every((e) => verifyReceipt(e.receipt!))).toBe(true);
  });

  it("closes a duplicate without paying and counts the budget from the derived ledger", async () => {
    const { store, deps } = await setup();
    const c = await createCase(deps, "test");
    await submitInvoice(deps, "test", c.id, { ...laura, payeeName: "Nube SaaS Inc.", payeeAccount: "US-999", invoiceNumber: "NB-0901", currency: "USD", amount: 300, concept: "Suscripción plataforma analítica" });
    const closed = await postVendorReply(deps, "test", c.id, { kind: "confirm_paid" });
    expect(closed.status).toBe("closed");
    expect(closed.settlement).toBeUndefined();
    expect(await ledger(store, "test")).toEqual([]);
  });

  it("sends a compromised correction to a person, who can reject but never approve it", async () => {
    const { deps } = await setup();
    const c = await createCase(deps, "test");
    await submitInvoice(deps, "test", c.id, laura);
    const human = await postVendorReply(deps, "test", c.id, { kind: "reissue", invoice: { amount: 6000000, payeeAccount: "NEQUI-777" } });
    expect(human.status).toBe("needs_human");
    expect(human.thread?.guardrail?.ok).toBe(false);
    await expect(reviewCase(deps, "test", c.id, { status: "approved", by: "cfo" })).rejects.toMatchObject({ status: 403 });
    const rejected = await reviewCase(deps, "test", c.id, { status: "rejected", by: "cfo", note: "cuenta desconocida" });
    expect(rejected.status).toBe("rejected");
    expect(await ledger(deps.store, "test")).toEqual([]);
  });

  it("approves an escalation and refuses a second invoice or a second review", async () => {
    const { store, deps } = await setup();
    await store.putCompany({ ...company, policy: { ...company.policy, humanApprovalAboveUSD: 1000 } });
    const c = await createCase(deps, "test");
    const esc = await submitInvoice(deps, "test", c.id, { ...laura, amount: 6000000 }); // 1,500 USD > 1,000 threshold, otherwise clean
    expect(esc.status).toBe("escalated");
    expect(esc.decision?.reasons).toEqual(["NEEDS_HUMAN_APPROVAL"]);
    await expect(submitInvoice(deps, "test", c.id, laura)).rejects.toMatchObject({ status: 409 });
    const approved = await reviewCase(deps, "test", c.id, { status: "approved", by: "cfo" });
    expect(approved.status).toBe("paid");
    expect(approved.settlement).toBeDefined();
    await expect(reviewCase(deps, "test", c.id, { status: "rejected", by: "cfo" })).rejects.toBeInstanceOf(HttpError);
    expect(await ledger(deps.store, "test")).toHaveLength(1);
  });

  it("rejects collector cases for now and unknown companies", async () => {
    const { deps } = await setup();
    await expect(createCase(deps, "test", { role: "collector" })).rejects.toMatchObject({ status: 501 });
    await expect(createCase(deps, "nope")).rejects.toMatchObject({ status: 404 });
  });

  it("holds without negotiating when a blocking reason is present", async () => {
    const { deps } = await setup();
    const c = await createCase(deps, "test");
    const held = await submitInvoice(deps, "test", c.id, { ...laura, payeeAccount: "NEQUI-777" });
    expect(held.status).toBe("held");
    expect(held.negotiationNote).toMatch(/cuenta bancaria distinta/);
    await expect(postVendorReply(deps, "test", c.id, { kind: "refuse" })).rejects.toMatchObject({ status: 409 });
  });

  it("the public view carries the conversation but no rule details", async () => {
    const { deps } = await setup();
    const c = await createCase(deps, "test");
    const held = await submitInvoice(deps, "test", c.id, laura);
    const view = publicCase(held, company);
    expect(view.thread?.messages[0].from).toBe("orbit");
    expect(view.reasons).toEqual(["No cuadra con el contrato"]);
    const json = JSON.stringify(view);
    expect(json).not.toMatch(/tolerancia|perPaymentLimit|monthlyBudget|humanApproval|8\.000|2\.000/);
  });
});

describe("memory store", () => {
  it("refuses stale updates", async () => {
    const store = new MemoryStore();
    await store.putCompany(company);
    const deps: CaseDeps = { store, today: TODAY, prose: templateProse, judge: quiet, executor: new MockExecutor() };
    const c = await createCase(deps, "test");
    const a = await store.getCase("test", c.id);
    const b = await store.getCase("test", c.id);
    await store.updateCase({ ...a!, status: "held" });
    await expect(store.updateCase({ ...b!, status: "closed" })).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("webhooks", () => {
  it("maps status transitions to event types", () => {
    expect(webhookTypeFor(undefined, "awaiting_invoice")).toBe("case.created");
    expect(webhookTypeFor("awaiting_invoice", "paid")).toBe("case.paid");
    expect(webhookTypeFor("negotiating", "paid")).toBe("case.resolved");
    expect(webhookTypeFor("negotiating", "needs_human")).toBe("case.needs_human");
    expect(webhookTypeFor("escalated", "rejected")).toBe("case.reviewed");
    expect(webhookTypeFor("negotiating", "negotiating")).toBeUndefined();
  });

  it("signs deliveries, verifies them, and logs every attempt", async () => {
    const { store, deps } = await setup();
    const withHook: Company = { ...company, webhook: { url: "https://hooks.example/orbit", secret: "s3cret" } };
    await store.putCompany(withHook);
    const c = await createCase(deps, "test");
    const paid = await submitInvoice(deps, "test", c.id, { ...laura, amount: 6000000 });
    expect(paid.status).toBe("paid");

    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    const okFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), headers: init!.headers as Record<string, string>, body: init!.body as string });
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    await emitWebhook(store, withHook, paid, "case.paid", { fetch: okFetch, link: "https://orbit.example/c/" + c.id });
    expect(calls).toHaveLength(1);
    expect(calls[0].headers["X-Orbit-Event"]).toBe("case.paid");
    expect(verifyWebhook("s3cret", calls[0].headers["X-Orbit-Signature"], calls[0].body)).toBe(true);
    expect(verifyWebhook("wrong", calls[0].headers["X-Orbit-Signature"], calls[0].body)).toBe(false);
    const body = JSON.parse(calls[0].body);
    expect(body.case).toMatchObject({ id: c.id, status: "paid", action: "PAY", settlementRef: paid.settlement?.ref });
    expect(verifyReceipt(body.receipt)).toBe(true);

    const failing = (async () => new Response("nope", { status: 500 })) as typeof fetch;
    await emitWebhook(store, withHook, paid, "case.paid", { fetch: failing });
    const attempts = await store.listEvents("test", { caseId: c.id, type: "webhook.attempt" });
    expect(attempts).toHaveLength(3);
    expect(attempts.slice(1).map((a) => (a.payload as { error?: string }).error)).toEqual(["HTTP 500", "HTTP 500"]);
  });

  it("does nothing without a configured URL", async () => {
    const { store, deps } = await setup();
    const c = await createCase(deps, "test");
    await emitWebhook(store, company, c, "case.created", { fetch: (async () => { throw new Error("should not be called"); }) as typeof fetch });
    expect(await store.listEvents("test", { type: "webhook.attempt" })).toEqual([]);
  });
});

import { decide, type DecideOptions } from "@/lib/engine/decide";
import { REASON_LABEL } from "@/lib/engine/labels";
import { effectiveDecision, ledgerFor, toPaymentRecord } from "@/lib/engine/ledger";
import { canNegotiate, openThread, stepThread, type NegotiationContext, type ProseWriter } from "@/lib/engine/negotiate";
import { policyHash, receiptFor } from "@/lib/engine/receipt";
import type { Case, CaseRole, Company, Invoice, NegotiationOutcome, PaymentExecutor, PaymentRecord, Receipt, Review, VendorReply } from "@/lib/engine/types";
import type { CaseStore } from "./store";

/**
 * Case service: one payment, one link, one thread. Framework-free so it runs against the in-memory
 * store in tests. Every state change appends an audit event (with a signed receipt when a decision
 * is involved) and then saves the case with optimistic concurrency.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface CaseDeps {
  store: CaseStore;
  /** Reference date for due dates and monthly budgets. */
  today: string;
  prose: ProseWriter;
  judge?: DecideOptions["judge"];
  executor: PaymentExecutor;
  now?: () => string;
  id?: () => string;
}

const nowIso = (d: CaseDeps) => d.now?.() ?? new Date().toISOString();
const newId = (d: CaseDeps) => d.id?.() ?? crypto.randomUUID();

export async function getCompanyOrThrow(store: CaseStore, companyId: string): Promise<Company> {
  const company = await store.getCompany(companyId);
  if (!company) throw new HttpError(404, `Unknown company ${companyId}`);
  return company;
}

async function getCaseOrThrow(store: CaseStore, companyId: string, id: string): Promise<Case> {
  const c = await store.getCase(companyId, id);
  if (!c) throw new HttpError(404, "Case not found");
  return c;
}

/** Payments that went out so far (one per paid case). Feeds budgets and duplicate checks. */
export async function ledger(store: CaseStore, companyId: string): Promise<PaymentRecord[]> {
  return ledgerFor(await store.listCases(companyId));
}

export async function createCase(deps: CaseDeps, companyId: string, input: { role?: CaseRole; source?: string; vendorHint?: Case["vendorHint"] } = {}): Promise<Case> {
  if (input.role === "collector") throw new HttpError(501, "Collector cases (cobrador) are on the roadmap; only payer cases exist today.");
  await getCompanyOrThrow(deps.store, companyId);
  const at = nowIso(deps);
  const c: Case = {
    id: newId(deps),
    companyId,
    role: "payer",
    status: "awaiting_invoice",
    source: input.source ?? "link",
    vendorHint: input.vendorHint,
    version: 1,
    createdAt: at,
    updatedAt: at,
  };
  await deps.store.createCase(c);
  await deps.store.appendEvent({ caseId: c.id, companyId, type: "case.created", payload: { source: c.source, vendorHint: c.vendorHint ?? null } });
  return c;
}

async function settle(deps: CaseDeps, c: Case): Promise<void> {
  const final = effectiveDecision(c.decision!, c.thread);
  const record = toPaymentRecord(final, deps.today);
  if (!record) throw new HttpError(500, "Cannot settle a payment without a registered beneficiary");
  c.settlement = await deps.executor.execute(record, c.id);
  c.status = "paid";
  await deps.store.appendEvent({ caseId: c.id, companyId: c.companyId, type: "settlement", payload: { settlement: c.settlement, record } });
}

function negotiationContext(deps: CaseDeps, company: Company, extraHistory: PaymentRecord[]): NegotiationContext {
  return { company, extraHistory, today: deps.today, prose: deps.prose, judge: deps.judge, now: deps.now, id: deps.id };
}

async function logClaraMessage(deps: CaseDeps, c: Case) {
  const m = c.thread!.messages.at(-1)!;
  await deps.store.appendEvent({ caseId: c.id, companyId: c.companyId, type: "orbit.message", payload: { requestType: m.requestType, text: m.text, prose: m.prose } });
}

/** The vendor (or the company) attaches the invoice: ORBIT decides and, when it can, starts negotiating. */
export async function submitInvoice(deps: CaseDeps, companyId: string, caseId: string, invoice: Invoice): Promise<Case> {
  const { store } = deps;
  const c = await getCaseOrThrow(store, companyId, caseId);
  if (c.invoice) throw new HttpError(409, "This case already has an invoice");
  const company = await getCompanyOrThrow(store, companyId);
  const extraHistory = await ledger(store, companyId);

  const decision = await decide(invoice, company, { today: deps.today, extraHistory, judge: deps.judge });
  c.invoice = invoice;
  c.decision = decision;
  c.policyHash = policyHash(company);
  c.receipt = receiptFor(c.id, decision, company);
  await store.appendEvent({ caseId: c.id, companyId, type: "invoice.submitted", payload: { invoice } });
  await store.appendEvent({ caseId: c.id, companyId, type: "decision", payload: decisionSummary(decision), receipt: c.receipt });

  if (decision.action === "PAY") {
    await settle(deps, c);
  } else if (decision.action === "ESCALATE") {
    c.status = "escalated";
  } else {
    const gate = canNegotiate(decision, company);
    if (gate.ok) {
      c.thread = await openThread(decision, negotiationContext(deps, company, extraHistory));
      c.status = "negotiating";
      await logClaraMessage(deps, c);
    } else {
      c.status = "held";
      c.negotiationNote = gate.why;
    }
  }
  return store.updateCase(c);
}

/** The vendor's cobrador (or a person on the link) answers ORBIT's request. */
export async function postVendorReply(deps: CaseDeps, companyId: string, caseId: string, reply: VendorReply): Promise<Case> {
  const { store } = deps;
  const c = await getCaseOrThrow(store, companyId, caseId);
  if (c.status !== "negotiating" || !c.thread?.pendingRequest || !c.decision) throw new HttpError(409, "This case is not waiting on the vendor");
  const company = await getCompanyOrThrow(store, companyId);
  const extraHistory = await ledger(store, companyId);
  const attemptsBefore = c.thread.attempts.length;

  const thread = await stepThread(c.thread, c.decision, reply, negotiationContext(deps, company, extraHistory));
  c.thread = thread;
  const vendorMsg = thread.messages.filter((m) => m.from === "vendor").at(-1)!;
  await store.appendEvent({ caseId: c.id, companyId, type: "vendor.message", payload: { replyKind: vendorMsg.replyKind, text: vendorMsg.text, invoice: vendorMsg.invoice ?? null } });
  if (thread.guardrail && !thread.guardrail.ok) {
    await store.appendEvent({ caseId: c.id, companyId, type: "correction.rejected", payload: { violations: thread.guardrail.violations } });
  }
  for (const attempt of thread.attempts.slice(attemptsBefore)) {
    await store.appendEvent({ caseId: c.id, companyId, type: "correction.decided", payload: decisionSummary(attempt), receipt: receiptFor(c.id, attempt, company) });
  }

  if (thread.status === "in_progress") {
    await logClaraMessage(deps, c);
    return store.updateCase(c);
  }
  switch (thread.outcome as NegotiationOutcome) {
    case "auto_resolved":
      c.decision.supersededBy = thread.finalDecision!.id;
      c.receipt = receiptFor(c.id, thread.finalDecision!, company);
      await settle(deps, c);
      break;
    case "scheduled":
      c.status = "scheduled";
      break;
    case "closed":
      c.status = "closed";
      break;
    default:
      c.status = "needs_human";
  }
  return store.updateCase(c);
}

/** A person approves or rejects. Only escalations can be approved; nothing a rule held can be paid from here. */
export async function reviewCase(deps: CaseDeps, companyId: string, caseId: string, input: { status: Review["status"]; by: string; note?: string }): Promise<Case> {
  const { store } = deps;
  const c = await getCaseOrThrow(store, companyId, caseId);
  if (!c.decision) throw new HttpError(409, "Nothing to review yet");
  if (c.review) throw new HttpError(409, "This case was already reviewed");
  if (input.status === "approved" && c.status !== "escalated") {
    throw new HttpError(403, "Only escalated cases can be approved; held cases need a corrected invoice");
  }
  if (!["escalated", "held", "needs_human", "scheduled"].includes(c.status)) throw new HttpError(409, `A ${c.status} case cannot be reviewed`);
  if (input.status === "approved" && !toPaymentRecord(effectiveDecision(c.decision, c.thread), deps.today)) {
    throw new HttpError(422, "Cannot settle a payment without a valid payee");
  }
  c.review = { status: input.status, by: input.by, at: nowIso(deps), note: input.note || undefined };
  await store.appendEvent({ caseId: c.id, companyId, type: "review", payload: c.review });
  if (input.status === "approved") await settle(deps, c);
  else c.status = "rejected";
  return store.updateCase(c);
}

function decisionSummary(d: Case["decision"] & object) {
  return { decisionId: d.id, action: d.action, reasons: d.reasons, amountUSD: d.amountUSD, invoiceNumber: d.invoice.invoiceNumber, explanation: d.explanation };
}

// ---------------------------------------------------------------------------
// What the vendor sees on the public link: the conversation and the outcome, never the company's rules.

export interface PublicCase {
  id: string;
  status: Case["status"];
  role: CaseRole;
  companyName: string;
  vendorName?: string;
  createdAt: string;
  updatedAt: string;
  invoice?: Pick<Invoice, "invoiceNumber" | "amount" | "currency" | "concept" | "dueDate" | "payeeName">;
  /** The agreement this case should match, when the company chose one. */
  contract?: { concept: string; amount: number; currency: string };
  reasons: string[];
  negotiationNote?: string;
  thread?: {
    status: "in_progress" | "done";
    rounds: number;
    maxRounds: number;
    pendingRequestType?: string;
    outcome?: NegotiationOutcome;
    outcomeDetail?: string;
    scheduledFor?: string;
    messages: { from: "orbit" | "vendor"; at: string; text: string; prose: string; requestType?: string; replyKind?: string; invoice?: Pick<Invoice, "invoiceNumber" | "amount" | "currency" | "concept"> }[];
  };
  settlement?: { ref: string; rail: string; at: string; note: string };
  receipt?: Receipt;
  review?: { status: Review["status"]; at: string };
}

export function publicCase(c: Case, company: Company): PublicCase {
  const d = c.decision ? effectiveDecision(c.decision, c.thread) : undefined;
  const pickInvoice = (i: Invoice) => ({ invoiceNumber: i.invoiceNumber, amount: i.amount, currency: i.currency, concept: i.concept });
  const contract = c.vendorHint?.contractId ? company.contracts.find((k) => k.id === c.vendorHint!.contractId) : undefined;
  return {
    contract: contract ? { concept: contract.concept, amount: contract.amount, currency: contract.currency } : undefined,
    id: c.id,
    status: c.status,
    role: c.role,
    companyName: company.company.name,
    vendorName: c.invoice?.payeeName ?? c.vendorHint?.name,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    invoice: c.invoice ? { ...pickInvoice(c.invoice), dueDate: c.invoice.dueDate, payeeName: c.invoice.payeeName } : undefined,
    reasons: d ? d.reasons.map((r) => REASON_LABEL[r]) : [],
    negotiationNote: c.negotiationNote,
    thread: c.thread
      ? {
          status: c.thread.status,
          rounds: c.thread.rounds,
          maxRounds: c.thread.maxRounds,
          pendingRequestType: c.thread.pendingRequest?.type,
          outcome: c.thread.outcome,
          outcomeDetail: c.thread.outcomeDetail,
          scheduledFor: c.thread.scheduledFor,
          messages: c.thread.messages.map((m) => ({
            from: m.from === "orbit" ? "orbit" : "vendor",
            at: m.at,
            text: m.text,
            prose: m.prose,
            requestType: m.requestType,
            replyKind: m.replyKind,
            invoice: m.invoice ? pickInvoice(m.invoice) : undefined,
          })),
        }
      : undefined,
    settlement: c.settlement,
    receipt: c.receipt,
    review: c.review ? { status: c.review.status, at: c.review.at } : undefined,
  };
}

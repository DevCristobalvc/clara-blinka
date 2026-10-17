import { toUSD } from "./fx";
import { DEFAULT_JEV_THRESHOLDS, judge, type JudgeInput } from "./jev";
import { findContract, matchBeneficiary, runRules } from "./rules";
import { explain } from "./explain";
import type { Action, Company, Decision, Invoice, JevAnswers, PaymentRecord, ReasonCode, Severity } from "./types";

export const DEFAULT_SEVERITY: Record<ReasonCode, Severity> = {
  DUPLICATE: "HOLD",
  BANK_DETAILS_CHANGED: "HOLD",
  CONTRACT_MISMATCH: "HOLD",
  CURRENCY_NOT_ALLOWED: "HOLD",
  SUSPICIOUS: "HOLD",
  DUE_TOO_FAR: "HOLD",
  NOT_ALLOWLISTED: "ESCALATE",
  OVER_PER_PAYMENT_LIMIT: "ESCALATE",
  NEEDS_HUMAN_APPROVAL: "ESCALATE",
  BUDGET_EXCEEDED: "ESCALATE",
  PAST_DUE: "ESCALATE",
  LOW_CONFIDENCE: "ESCALATE",
};

export interface DecideOptions {
  /** Reference date for due dates and monthly budgets (ISO date). */
  today?: string;
  /** Payments approved earlier in this session, on top of company.history. */
  extraHistory?: PaymentRecord[];
  /** Override the judgment step (tests, eval). */
  judge?: (input: JudgeInput) => Promise<JevAnswers>;
  id?: string;
}

export function jevReasons(jev: JevAnswers, company: Company): { code: ReasonCode; detail: string }[] {
  const t = { ...DEFAULT_JEV_THRESHOLDS, ...company.policy.jev };
  const out: { code: ReasonCode; detail: string }[] = [];
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  if (jev.socialEngineering >= t.maxSocialEngineering) {
    out.push({
      code: "SUSPICIOUS",
      detail: `El mensaje muestra señales de presión o cambio de cuenta (probabilidad ${pct(jev.socialEngineering)}, umbral ${pct(t.maxSocialEngineering)}).`,
    });
  }
  if (jev.conceptMatchesContract !== undefined && jev.conceptMatchesContract < t.minConceptMatch) {
    out.push({
      code: "LOW_CONFIDENCE",
      detail: `No es claro que el concepto corresponda al contrato (probabilidad ${pct(jev.conceptMatchesContract)}, mínimo ${pct(t.minConceptMatch)}).`,
    });
  }
  if (jev.risk && jev.risk.score === "high") {
    out.push({ code: "LOW_CONFIDENCE", detail: `El modelo califica el riesgo como alto (confianza ${pct(jev.risk.confidence)}).` });
  }
  return out;
}

export function actionFor(reasons: ReasonCode[], company: Company): Action {
  const severity = { ...DEFAULT_SEVERITY, ...company.policy.severity };
  if (reasons.some((r) => severity[r] === "HOLD")) return "HOLD";
  if (reasons.length > 0) return "ESCALATE";
  return "PAY";
}

export async function decide(invoice: Invoice, company: Company, opts: DecideOptions = {}): Promise<Decision> {
  const today = new Date(`${opts.today ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const amountUSD = toUSD(invoice.amount, invoice.currency);
  const match = matchBeneficiary(invoice, company.beneficiaries);
  const contract = findContract(invoice, company.contracts, match.beneficiary?.id);
  const history = [...company.history, ...(opts.extraHistory ?? [])];

  // JEV only answers fuzzy questions; it can make a decision stricter, never looser.
  const jev = await (opts.judge ?? judge)({ invoice, beneficiary: match.beneficiary, contract });
  const category = match.beneficiary?.category ?? jev.category?.choice ?? "other";

  const rules = runRules({ invoice, company, today, amountUSD, match, contract, category, history });
  for (const r of jevReasons(jev, company)) rules.push({ rule: "jev", pass: false, code: r.code, detail: r.detail });

  const reasons = [...new Set(rules.filter((r) => !r.pass && r.code).map((r) => r.code as ReasonCode))];
  const action = actionFor(reasons, company);

  // Safety invariant: nothing outside the rules is ever paid autonomously.
  if (action === "PAY" && (reasons.length > 0 || rules.some((r) => !r.pass) || Number.isNaN(amountUSD))) {
    throw new Error("Safety invariant violated: PAY with failing checks");
  }

  const decision: Decision = {
    id: opts.id ?? crypto.randomUUID(),
    action,
    reasons,
    amountUSD,
    beneficiaryId: match.beneficiary?.id,
    category,
    rules,
    jev,
    explanation: "",
    invoice,
    decidedAt: new Date().toISOString(),
  };
  decision.explanation = explain(decision);
  return decision;
}

/** Turn an approved or auto-paid decision into a ledger entry (counts for budget and duplicates). */
export function toPaymentRecord(decision: Decision, paidAt: string): PaymentRecord | undefined {
  if (!decision.beneficiaryId) return undefined;
  return {
    invoiceNumber: decision.invoice.invoiceNumber,
    beneficiaryId: decision.beneficiaryId,
    amount: decision.invoice.amount,
    currency: decision.invoice.currency,
    paidAt,
    category: decision.category,
  };
}

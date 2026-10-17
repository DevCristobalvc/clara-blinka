import type { Case, Decision, NegotiationThread, PaymentRecord } from "./types";

/** Turn an auto-paid or human-approved decision into a ledger entry (counts for budget and duplicates). */
export function toPaymentRecord(decision: Decision, paidAt: string): PaymentRecord | undefined {
  if (!decision.beneficiaryId) return undefined;
  return {
    invoiceNumber: decision.invoice.invoiceNumber,
    beneficiaryId: decision.beneficiaryId,
    amount: decision.invoice.amount,
    currency: decision.invoice.currency,
    paidAt,
    issueDate: decision.invoice.issueDate,
    category: decision.category,
  };
}

/** The decision that stands for a case: the negotiated one when the vendor fixed the invoice, else the original. */
export function effectiveDecision(decision: Decision, thread?: NegotiationThread): Decision {
  return thread?.outcome === "auto_resolved" && thread.finalDecision ? thread.finalDecision : decision;
}

/** Payments that went out: one record per paid case (auto-paid, negotiated or approved by a person). */
export function ledgerFor(cases: Case[]): PaymentRecord[] {
  return cases
    .filter((c) => c.status === "paid" && c.decision)
    .map((c) => toPaymentRecord(effectiveDecision(c.decision!, c.thread), (c.settlement?.at ?? c.updatedAt).slice(0, 10)))
    .filter((r): r is PaymentRecord => Boolean(r));
}

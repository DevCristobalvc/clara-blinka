import type { Decision, PaymentRecord } from "./types";

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

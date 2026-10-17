export type Action = "PAY" | "HOLD" | "ESCALATE";

export const REASON_CODES = [
  "NOT_ALLOWLISTED",
  "OVER_PER_PAYMENT_LIMIT",
  "NEEDS_HUMAN_APPROVAL",
  "BUDGET_EXCEEDED",
  "DUPLICATE",
  "CONTRACT_MISMATCH",
  "BANK_DETAILS_CHANGED",
  "CURRENCY_NOT_ALLOWED",
  "PAST_DUE",
  "DUE_TOO_FAR",
  "LOW_CONFIDENCE",
  "SUSPICIOUS",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

export type Severity = "HOLD" | "ESCALATE";

export interface Policy {
  perPaymentLimitUSD: number;
  humanApprovalAboveUSD: number;
  monthlyBudgetUSD: Record<string, number>;
  allowedCurrencies: string[];
  maxDaysUntilDue: number;
  duplicateWindowDays: number;
  /** Optional override of the default action per reason code. */
  severity?: Partial<Record<ReasonCode, Severity>>;
  /** JEV thresholds. */
  jev?: Partial<JevThresholds>;
}

export interface JevThresholds {
  /** Below this probability that the concept matches the contract, escalate. */
  minConceptMatch: number;
  /** At or above this probability of social engineering, hold. */
  maxSocialEngineering: number;
  /** Minimum confidence JEV must report on its answers; below it, escalate. */
  minConfidence: number;
}

export interface Account {
  type: "bank" | "wallet";
  value: string;
}

export interface Beneficiary {
  id: string;
  name: string;
  country: string;
  currency: string;
  account: Account;
  category: string;
}

export interface Contract {
  id: string;
  beneficiaryId: string;
  concept: string;
  amount: number;
  currency: string;
  tolerancePct: number;
  frequency: string;
}

export interface PaymentRecord {
  invoiceNumber: string;
  beneficiaryId: string;
  amount: number;
  currency: string;
  paidAt: string;
  category: string;
}

export interface Company {
  company: { name: string; country: string; baseCurrency: string };
  policy: Policy;
  beneficiaries: Beneficiary[];
  contracts: Contract[];
  history: PaymentRecord[];
}

export interface Invoice {
  payeeName: string;
  payeeAccount?: string;
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  amount: number;
  concept: string;
  channel?: "pdf" | "image" | "email" | "chat" | "text";
  /** Original message text (email body, chat), used for JEV judgments. */
  rawText?: string;
}

export interface RuleResult {
  rule: string;
  pass: boolean;
  code?: ReasonCode;
  detail: string;
}

export interface JevAnswers {
  source: "jev" | "offline";
  model?: string;
  latencyMs: number;
  conceptMatchesContract?: number;
  socialEngineering: number;
  category?: { choice: string; confidence: number };
  risk?: { score: string; confidence: number };
}

export interface Decision {
  id: string;
  action: Action;
  reasons: ReasonCode[];
  amountUSD: number;
  beneficiaryId?: string;
  category: string;
  rules: RuleResult[];
  jev?: JevAnswers;
  explanation: string;
  invoice: Invoice;
  decidedAt: string;
}

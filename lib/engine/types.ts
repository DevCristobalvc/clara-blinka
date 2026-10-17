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
  /** Whether ORBIT may ask the vendor for corrections on negotiable HOLDs (default: enabled, 2 rounds). */
  negotiation?: NegotiationPolicy;
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
  /** Issue date of the paid invoice; duplicates by amount are compared on issue dates. */
  issueDate?: string;
  category: string;
}

export interface Company {
  /** Store key; the demo company is "andes". */
  id?: string;
  company: { name: string; country: string; baseCurrency: string };
  /** Where ORBIT reports case events (signed). */
  webhook?: WebhookConfig;
  /** Which agents the company has activated (paid for). */
  agents?: Partial<Record<AgentKind, AgentActivation>>;
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
  /** Set on a HOLD that a negotiated, corrected invoice replaced (id of the final decision). */
  supersededBy?: string;
}

// ---------------------------------------------------------------------------
// Negotiation: ORBIT (paying) talks to the vendor's cobrador (collecting) to fix an invoice.

export const NEGOTIABLE_CODES = ["CONTRACT_MISMATCH", "CURRENCY_NOT_ALLOWED", "DUPLICATE", "DUE_TOO_FAR", "LOW_CONFIDENCE"] as const satisfies readonly ReasonCode[];
export type NegotiableCode = (typeof NEGOTIABLE_CODES)[number];

export interface NegotiationPolicy {
  enabled: boolean;
  maxRounds?: number;
}

export type Language = "es" | "en" | "pt";

export type RequestType = "reissue_at_contract_amount" | "reissue_in_currency" | "confirm_already_paid" | "schedule_payment" | "clarify_concept";
export type VendorReplyKind = "reissue" | "confirm_paid" | "acknowledge_schedule" | "clarify" | "refuse";

/**
 * Everything the prose layer is allowed to say. Deliberately has no tolerance, budget, per-payment
 * limit, approval threshold or max-days field: the company's limits never leave the engine.
 */
export interface ProseFacts {
  language: Language;
  vendorName: string;
  companyName: string;
  invoiceNumber: string;
  concept: string;
  amount: number;
  currency: string;
  dueDate?: string;
  contractAmount?: number;
  contractCurrency?: string;
  contractConcept?: string;
  /** Currency the vendor is asked to bill in. */
  targetCurrency?: string;
  paidRecord?: { invoiceNumber: string; amount: number; currency: string; paidAt: string };
  scheduledFor?: string;
}

export interface ClaraRequest {
  type: RequestType;
  facts: ProseFacts;
}

/** The vendor's answer. Only the structured fields reach the rules; `text` and `note` are display/JEV only. */
export interface VendorReply {
  kind: VendorReplyKind;
  invoice?: Partial<Pick<Invoice, "amount" | "currency" | "payeeAccount" | "invoiceNumber" | "concept">>;
  /** A fact for the prose layer ("the price went up", "sent from the new account"). */
  note?: string;
  /** The vendor's own words (live vendor or injected text). Untrusted. */
  text?: string;
}

export type Counterparty = (request: ClaraRequest, invoice: Invoice) => Promise<VendorReply> | VendorReply;

export interface NegotiationMessage {
  from: "orbit" | "vendor";
  at: string;
  text: string;
  prose: "claude" | "template" | "vendor";
  requestType?: RequestType;
  replyKind?: VendorReplyKind;
  /** Structured corrected invoice carried by a reissue. */
  invoice?: Invoice;
}

export type NegotiationOutcome = "auto_resolved" | "scheduled" | "closed" | "human";

export interface NegotiationThread {
  id: string;
  originalDecisionId: string;
  status: "in_progress" | "done";
  rounds: number;
  maxRounds: number;
  messages: NegotiationMessage[];
  /** What ORBIT is waiting on while in progress. */
  pendingRequest?: ClaraRequest;
  /** Every re-run of decide() on a corrected invoice, in order. */
  attempts: Decision[];
  outcome?: NegotiationOutcome;
  /** Plain-language Spanish summary for the log. */
  outcomeDetail?: string;
  /** The decision that stands after the negotiation (PAY when auto_resolved). */
  finalDecision?: Decision;
  guardrail?: { ok: boolean; violations: string[] };
  scheduledFor?: string;
}

export interface Settlement {
  ref: string;
  rail: string;
  at: string;
  note: string;
}

export interface PaymentExecutor {
  execute(record: PaymentRecord, caseId: string): Promise<Settlement>;
}

// ---------------------------------------------------------------------------
// Cases: one payment, one link, one thread.

export type CaseRole = "payer" | "collector";
export type CaseStatus = "awaiting_invoice" | "paid" | "held" | "escalated" | "negotiating" | "scheduled" | "closed" | "needs_human" | "rejected";

export interface Review {
  status: "approved" | "rejected";
  by: string;
  at: string;
  note?: string;
}

export interface Expected {
  file: string;
  expectedAction: Action;
  reasonCodes: ReasonCode[];
  expectedResolution?: NegotiationOutcome;
  note?: string;
}

export interface ReceiptPayload {
  caseId: string;
  decisionId: string;
  action: Action;
  reasons: ReasonCode[];
  invoiceNumber: string;
  beneficiaryId?: string;
  amount: number;
  currency: string;
  amountUSD: number;
  /** sha256 of the rules in force when this was decided. */
  policyHash: string;
  decidedAt: string;
  engine: string;
  /** True when the server had no ORBIT_SIGNING_KEY and signed with a per-process key. */
  ephemeral?: boolean;
}

export interface Receipt {
  payload: ReceiptPayload;
  signature: string;
  publicKey: string;
  alg: "ed25519";
}

export interface WebhookConfig {
  url?: string;
  secret?: string;
}

// ---------------------------------------------------------------------------
// Agents the company hires: the pagador (pays) and the cobrador (collects). Activated by paying ORBIT.

export type AgentKind = "pagador" | "cobrador";

export interface AgentFunding {
  amount: string;
  asset: string;
  network: string;
  at: string;
  payer?: string;
  transaction?: string;
}

export interface AgentActivation {
  active: boolean;
  activatedAt: string;
  /** The agent's own wallet (per company): where the company loads the funds the agent pays from. */
  wallet?: string;
  funding?: AgentFunding[];
  /** How it was paid: x402 over USDC (network in CAIP-2), or a demo activation. */
  payment: {
    method: "x402" | "demo";
    network?: string;
    asset?: string;
    amount?: string;
    payer?: string;
    transaction?: string;
  };
}

export interface Case {
  id: string;
  companyId: string;
  role: CaseRole;
  status: CaseStatus;
  /** Dataset file for demo cases, "link" for real ones. */
  source?: string;
  /** Who the case is with, chosen when it is opened: the registered vendor and the contract it should match. */
  vendorHint?: { beneficiaryId?: string; name?: string; contractId?: string; note?: string };
  invoice?: Invoice;
  decision?: Decision;
  thread?: NegotiationThread;
  /** Why a HOLD was not negotiated (plain language), when that is the case. */
  negotiationNote?: string;
  review?: Review;
  settlement?: Settlement;
  receipt?: Receipt;
  policyHash?: string;
  /** Optimistic-concurrency counter; every update must carry the version it read. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

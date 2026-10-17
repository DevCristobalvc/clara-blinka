import { toPaymentRecord } from "@/lib/engine/ledger";
import type { Action, Company, Decision, Invoice, PaymentRecord, ReasonCode } from "@/lib/engine/types";

export interface Expected {
  file: string;
  expectedAction: Action;
  reasonCodes: ReasonCode[];
  note?: string;
}

export interface Review {
  status: "approved" | "rejected";
  by: string;
  at: string;
  note?: string;
}

export interface Item {
  decision: Decision;
  source: string;
  expected?: Expected;
  review?: Review;
}

export interface AppState {
  company: Company;
  items: Item[];
  today: string;
}

export const ACTION_LABEL: Record<Action, string> = {
  PAY: "Pagada",
  HOLD: "Frenada",
  ESCALATE: "Escalada",
};

export const REASON_LABEL: Record<ReasonCode, string> = {
  NOT_ALLOWLISTED: "Beneficiario no permitido",
  OVER_PER_PAYMENT_LIMIT: "Supera límite por pago",
  NEEDS_HUMAN_APPROVAL: "Requiere aprobación humana",
  BUDGET_EXCEEDED: "Presupuesto insuficiente",
  DUPLICATE: "Cobro duplicado",
  CONTRACT_MISMATCH: "No cuadra con el contrato",
  BANK_DETAILS_CHANGED: "Cuenta bancaria distinta",
  CURRENCY_NOT_ALLOWED: "Moneda no permitida",
  PAST_DUE: "Factura vencida",
  DUE_TOO_FAR: "Pago demasiado anticipado",
  LOW_CONFIDENCE: "Baja confianza",
  SUSPICIOUS: "Señales de fraude",
};

/** Payments that actually went out: auto-paid plus escalations a person approved. */
export function ledger(state: AppState): PaymentRecord[] {
  return state.items
    .filter((i) => i.decision.action === "PAY" || i.review?.status === "approved")
    .map((i) => toPaymentRecord(i.decision, i.review?.at.slice(0, 10) ?? state.today))
    .filter((r): r is PaymentRecord => Boolean(r));
}

export async function requestDecision(state: AppState, invoice: Invoice): Promise<Decision> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ invoice, company: state.company, extraHistory: ledger(state), today: state.today }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as Decision;
}

const KEY = "clara-state-v1";

export function loadState(): AppState | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AppState) : undefined;
  } catch {
    return undefined;
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the session still works in memory.
  }
}

export interface EvalResult {
  total: number;
  correct: number;
  autonomous: number;
  unsafePays: Item[];
  explained: number;
  rows: { item: Item; ok: boolean }[];
}

export function evaluate(items: Item[]): EvalResult {
  const scored = items.filter((i) => i.expected);
  const rows = scored.map((item) => ({ item, ok: item.decision.action === item.expected!.expectedAction }));
  return {
    total: scored.length,
    correct: rows.filter((r) => r.ok).length,
    // Decided correctly without a person: right answer and not handed to a human.
    autonomous: rows.filter((r) => r.ok && r.item.decision.action !== "ESCALATE").length,
    unsafePays: scored.filter((i) => i.decision.action === "PAY" && i.expected!.expectedAction !== "PAY"),
    explained: scored.filter((i) => i.decision.explanation && (i.decision.action === "PAY" || i.decision.reasons.length > 0)).length,
    rows,
  };
}

export function fmtMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtUSD(amount: number) {
  return `USD ${amount.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

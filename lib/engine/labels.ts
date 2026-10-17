import type { Action, CaseStatus, NegotiationOutcome, ReasonCode } from "./types";

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

export const RULE_LABEL: Record<string, string> = {
  allowlist: "Beneficiario permitido",
  bank_details: "Cuenta bancaria",
  currency: "Moneda",
  contract: "Contrato",
  per_payment_limit: "Límite por pago",
  human_threshold: "Umbral de aprobación humana",
  period_budget: "Presupuesto del mes",
  duplicate: "Duplicados",
  due_date: "Fecha de vencimiento",
  jev: "Juicio JEV",
};

export const OUTCOME_LABEL: Record<NegotiationOutcome, string> = {
  auto_resolved: "Corregida por el proveedor y pagada",
  scheduled: "Programada",
  closed: "Cerrada: ya estaba pagada",
  human: "Sin acuerdo: necesita una persona",
};

export const STATUS_LABEL: Record<CaseStatus, string> = {
  awaiting_invoice: "Esperando factura",
  paid: "Pagada",
  held: "Frenada",
  escalated: "Pendiente de aprobación",
  negotiating: "Resolviendo con el proveedor",
  scheduled: "Programada",
  closed: "Cerrada",
  needs_human: "Necesita una persona",
  rejected: "Rechazada",
};

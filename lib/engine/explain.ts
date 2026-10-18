import type { Decision, ReasonCode } from "./types";

const HEADLINE = {
  PAY: "Pagada automáticamente: cumple todas las reglas de la empresa.",
  HOLD: "Frenada: no se paga hasta resolver lo siguiente.",
  ESCALATE: "Escalada a una persona: se sale de lo que el agente puede aprobar solo.",
} as const;

const COUNTERFACTUAL_STEP: Record<ReasonCode, string> = {
  NOT_ALLOWLISTED: "registrar al beneficiario en la lista permitida",
  BANK_DETAILS_CHANGED: "usar la cuenta bancaria registrada del beneficiario",
  CURRENCY_NOT_ALLOWED: "emitir la factura en una moneda permitida por la política",
  CONTRACT_MISMATCH: "ajustar el monto y moneda a lo pactado en el contrato (dentro de la tolerancia)",
  OVER_PER_PAYMENT_LIMIT: "un monto dentro del límite máximo por pago",
  NEEDS_HUMAN_APPROVAL: "un monto igual o menor al umbral de aprobación automática",
  BUDGET_EXCEEDED: "contar con saldo suficiente en el presupuesto mensual de la categoría",
  DUPLICATE: "confirmar que corresponde a un cobro nuevo y no a una factura ya pagada",
  PAST_DUE: "presentar una factura con fecha de vencimiento vigente",
  DUE_TOO_FAR: "estar dentro de la ventana de anticipación permitida antes del vencimiento",
  LOW_CONFIDENCE: "un concepto alineado con el contrato y riesgo bajo en la evaluación",
  SUSPICIOUS: "un mensaje sin presión de urgencia ni solicitud de cambio de cuenta bancaria",
};

/** Counterfactual condition: what would have been required for autonomous payment. */
export function counterfactual(d: Decision): string | undefined {
  if (d.action === "PAY" || d.reasons.length === 0) return undefined;
  const conditions = d.reasons.map((r) => COUNTERFACTUAL_STEP[r]).filter(Boolean);
  if (!conditions.length) return undefined;
  return `Se habría pagado automáticamente con: ${conditions.join("; ")}.`;
}

/** Plain-language log entry; anyone should understand the decision without reading code. */
export function explain(d: Decision): string {
  const inv = d.invoice;
  const amount = `${inv.amount.toLocaleString("es-CO")} ${inv.currency}${inv.currency !== "USD" ? ` (≈ USD ${d.amountUSD.toLocaleString("es-CO")})` : ""}`;
  const failed = d.rules.filter((r) => !r.pass);
  const lines = [`${HEADLINE[d.action]}`, `Factura ${inv.invoiceNumber} de "${inv.payeeName}" por ${amount}: ${inv.concept}.`];
  if (failed.length) {
    lines.push("Motivos:");
    for (const r of failed) lines.push(`• ${r.detail}`);
  } else {
    const passed = d.rules.filter((r) => ["allowlist", "contract", "per_payment_limit", "period_budget", "duplicate"].includes(r.rule));
    lines.push("Verificado:");
    for (const r of passed) lines.push(`• ${r.detail}`);
  }
  if (d.jev) {
    const src = d.jev.source === "jev" ? `JEV (${d.jev.model ?? "jev"}, ${d.jev.latencyMs} ms)` : "heurística local (JEV no disponible)";
    lines.push(`Juicio rápido por ${src}: riesgo ${d.jev.risk?.score ?? "n/d"}, presión/cambio de cuenta ${Math.round(d.jev.socialEngineering * 100)}%.`);
  }
  const cf = counterfactual(d);
  if (cf) lines.push(cf);
  if (d.action === "ESCALATE") lines.push("Siguiente paso: una persona debe aprobar o rechazar este pago.");
  if (d.action === "HOLD") lines.push("Siguiente paso: contactar al proveedor o corregir la factura antes de pagar.");
  return lines.join("\n");
}

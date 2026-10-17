import type { Decision } from "./types";

const HEADLINE = {
  PAY: "Pagada automáticamente: cumple todas las reglas de la empresa.",
  HOLD: "Frenada: no se paga hasta resolver lo siguiente.",
  ESCALATE: "Escalada a una persona: se sale de lo que el agente puede aprobar solo.",
} as const;

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
  if (d.action === "ESCALATE") lines.push("Siguiente paso: una persona debe aprobar o rechazar este pago.");
  if (d.action === "HOLD") lines.push("Siguiente paso: contactar al proveedor o corregir la factura antes de pagar.");
  return lines.join("\n");
}

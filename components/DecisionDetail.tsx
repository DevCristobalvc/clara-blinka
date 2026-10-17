"use client";

import { useState } from "react";
import { fmtMoney, fmtUSD, type Item } from "@/lib/client/store";
import { ActionBadge, Button, ProbabilityBar, ReasonChip } from "./ui";

const RULE_LABEL: Record<string, string> = {
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

export function DecisionDetail({
  item,
  onClose,
  onReview,
}: {
  item: Item;
  onClose: () => void;
  onReview: (status: "approved" | "rejected", note: string) => void;
}) {
  const { decision: d } = item;
  const [note, setNote] = useState("");
  const inv = d.invoice;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-zinc-500">{item.source}</p>
            <h2 className="text-lg font-semibold text-white">{inv.payeeName}</h2>
            <p className="text-sm text-zinc-400">{inv.concept}</p>
          </div>
          <div className="flex items-center gap-2">
            <ActionBadge action={d.action} />
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-panel-2 p-4 text-sm sm:grid-cols-3">
          <Field label="Monto" value={`${fmtMoney(inv.amount, inv.currency)}${inv.currency !== "USD" ? ` · ${fmtUSD(d.amountUSD)}` : ""}`} />
          <Field label="Factura" value={inv.invoiceNumber || "—"} />
          <Field label="Categoría" value={d.category} />
          <Field label="Emitida" value={inv.issueDate ?? "—"} />
          <Field label="Vence" value={inv.dueDate ?? "—"} />
          <Field label="Cuenta en factura" value={inv.payeeAccount ?? "—"} />
        </dl>

        <h3 className="mt-6 text-sm font-semibold text-white">Por qué</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line p-4 font-sans text-sm leading-relaxed text-zinc-100">{d.explanation}</pre>

        {d.action === "ESCALATE" ? (
          <div className="mt-4 rounded-lg border border-orbit/40 bg-orbit/10 p-4">
            {item.review ? (
              <p className="text-sm text-orbit">
                {item.review.status === "approved" ? "Aprobada" : "Rechazada"} por <b>{item.review.by}</b> el {new Date(item.review.at).toLocaleString("es-CO")}
                {item.review.note ? ` · “${item.review.note}”` : ""}
              </p>
            ) : (
              <>
                <p className="text-sm font-medium text-orbit">Esta factura necesita una decisión humana.</p>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nota para el registro (opcional)"
                  className="mt-2 w-full rounded-md border border-line bg-panel-2 px-3 py-1.5 text-sm"
                />
                <div className="mt-3 flex gap-2">
                  <Button onClick={() => onReview("approved", note)}>Aprobar pago</Button>
                  <Button variant="secondary" onClick={() => onReview("rejected", note)}>Rechazar</Button>
                </div>
              </>
            )}
          </div>
        ) : null}

        <h3 className="mt-6 text-sm font-semibold text-white">Reglas de la empresa</h3>
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {d.rules.map((r, i) => (
            <li key={i} className="flex gap-3 p-3 text-sm">
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${r.pass ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{r.pass ? "✓" : "✕"}</span>
              <div>
                <p className="font-medium text-zinc-100">
                  {RULE_LABEL[r.rule] ?? r.rule} {r.code ? <ReasonChip code={r.code} /> : null}
                </p>
                <p className="text-zinc-400">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>

        {d.jev ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-white">
              Juicios rápidos {d.jev.source === "jev" ? `· JEV ${d.jev.model ?? ""} · ${d.jev.latencyMs} ms` : "· heurística local (sin JEV)"}
            </h3>
            <div className="mt-2 space-y-2 rounded-lg border border-line p-4 text-sm">
              {d.jev.conceptMatchesContract !== undefined ? (
                <Row label="¿El concepto corresponde al contrato?">
                  <ProbabilityBar value={d.jev.conceptMatchesContract} />
                </Row>
              ) : null}
              <Row label="¿Presión, urgencia o cambio de cuenta?">
                <ProbabilityBar value={d.jev.socialEngineering} danger />
              </Row>
              {d.jev.category ? (
                <Row label="Categoría estimada">
                  <span className="font-mono text-xs">
                    {d.jev.category.choice} · confianza {Math.round(d.jev.category.confidence * 100)}%
                  </span>
                </Row>
              ) : null}
              {d.jev.risk ? (
                <Row label="Riesgo">
                  <span className="font-mono text-xs">
                    {d.jev.risk.score} · confianza {Math.round(d.jev.risk.confidence * 100)}%
                  </span>
                </Row>
              ) : null}
              <p className="pt-1 text-xs text-zinc-500">JEV solo puede volver más estricta una decisión: nunca aprueba lo que las reglas frenan.</p>
            </div>
          </>
        ) : null}

        {inv.rawText ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-white">Mensaje original</h3>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-panel-2 p-4 text-xs text-zinc-300">{inv.rawText}</pre>
          </>
        ) : null}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="truncate font-medium text-white" title={value}>{value}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-zinc-300">{label}</span>
      {children}
    </div>
  );
}

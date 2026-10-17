"use client";

import { useMemo, useState } from "react";
import { fmtMoney, fmtUSD } from "@/lib/client/format";
import { OUTCOME_LABEL, REASON_LABEL, RULE_LABEL, STATUS_LABEL } from "@/lib/engine/labels";
import { effectiveDecision } from "@/lib/engine/ledger";
import type { Case, CaseStatus } from "@/lib/engine/types";
import { Button, ReasonChip } from "../ui";

export const STATUS_TONE: Record<CaseStatus, string> = {
  awaiting_invoice: "bg-zinc-700/40 text-zinc-200",
  negotiating: "bg-orbit/15 text-orbit",
  paid: "bg-emerald-500/15 text-emerald-300",
  scheduled: "bg-sky-500/15 text-sky-300",
  closed: "bg-zinc-700/40 text-zinc-200",
  held: "bg-rose-500/15 text-rose-300",
  needs_human: "bg-amber-500/15 text-amber-300",
  escalated: "bg-amber-500/15 text-amber-300",
  rejected: "bg-zinc-700/40 text-zinc-300",
};

export function StatusChip({ status, className = "" }: { status: CaseStatus; className?: string }) {
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]} ${className}`}>{STATUS_LABEL[status]}</span>;
}

export function CaseDetail({ c, busy, onClose, onCobrador, onReview }: { c: Case; busy: boolean; onClose: () => void; onCobrador: () => void; onReview: (status: "approved" | "rejected", note: string) => void }) {
  const [note, setNote] = useState("");
  const d = c.decision ? effectiveDecision(c.decision, c.thread) : undefined;
  const link = useMemo(() => (typeof window === "undefined" ? `/c/${c.id}` : `${window.location.origin}/c/${c.id}`), [c.id]);
  const canApprove = c.status === "escalated";
  const canReject = ["escalated", "held", "needs_human", "scheduled"].includes(c.status) && !c.review;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto bg-panel p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-zinc-500">{c.source ?? "enlace"} · {new Date(c.createdAt).toLocaleString("es-CO")}</p>
            <h2 className="text-lg font-semibold text-white">{c.invoice?.payeeName ?? c.vendorHint?.name ?? "Caso sin factura"}</h2>
            <p className="text-sm text-zinc-400">{c.invoice?.concept}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusChip status={c.status} className="rounded-full px-2.5 text-xs" />
            <Button variant="ghost" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <code className="truncate rounded bg-black/40 px-2 py-1 font-mono text-zinc-300">{link}</code>
          <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(link)}>Copiar enlace</Button>
          <a href={link} target="_blank" rel="noreferrer" className="text-zinc-400 underline hover:text-white">Ver como proveedor</a>
        </div>
        {c.invite ? (
          <p className="mt-2 text-xs text-emerald-300">
            Enlace enviado a <span className="font-mono">{c.invite.email}</span> · {new Date(c.invite.sentAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}{c.invite.delivery === "recorded" ? " · registrado (sin proveedor de correo configurado)" : " · por correo"}
          </p>
        ) : null}

        {d ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-panel-2 p-4 text-sm sm:grid-cols-3">
              <Field label="Monto" value={`${fmtMoney(d.invoice.amount, d.invoice.currency)}${d.invoice.currency !== "USD" ? ` · ${fmtUSD(d.amountUSD)}` : ""}`} />
              <Field label="Factura" value={d.invoice.invoiceNumber || "—"} />
              <Field label="Categoría" value={d.category} />
              <Field label="Vence" value={d.invoice.dueDate ?? "—"} />
              <Field label="Cuenta en factura" value={d.invoice.payeeAccount ?? "—"} />
              <Field label="Registro de pago" value={c.settlement?.ref ?? "—"} />
            </dl>

            <h3 className="mt-6 text-sm font-semibold text-white">Por qué</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line p-4 font-sans text-sm leading-relaxed text-zinc-200">{d.explanation}</pre>
            {c.negotiationNote ? <p className="mt-2 text-sm text-amber-300">{c.negotiationNote}</p> : null}
            {c.settlement ? <p className="mt-2 text-xs text-zinc-500">{c.settlement.note}</p> : null}
          </>
        ) : (
          <p className="mt-4 text-sm text-zinc-500">El proveedor aún no adjunta la factura. Comparte el enlace.</p>
        )}

        {(canApprove || canReject) && !c.review ? (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm font-medium text-amber-200">{canApprove ? "Esta factura necesita una decisión humana." : "Una regla la frenó: solo puede rechazarse, o corregirse desde el enlace del proveedor."}</p>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para el registro (opcional)" className="mt-2 w-full rounded-md border border-amber-500/30 px-3 py-1.5 text-sm" />
            <div className="mt-3 flex gap-2">
              {canApprove ? <Button disabled={busy} onClick={() => onReview("approved", note)}>Aprobar pago</Button> : null}
              <Button variant="secondary" disabled={busy} onClick={() => onReview("rejected", note)}>Rechazar</Button>
            </div>
          </div>
        ) : null}
        {c.review ? (
          <p className="mt-4 text-sm text-zinc-300">
            {c.review.status === "approved" ? "Aprobada" : "Rechazada"} por <b>{c.review.by}</b> el {new Date(c.review.at).toLocaleString("es-CO")}{c.review.note ? ` · “${c.review.note}”` : ""}
          </p>
        ) : null}

        {c.thread ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-white">
              Negociación con el proveedor · {c.thread.rounds}/{c.thread.maxRounds} rondas{c.thread.outcome ? ` · ${OUTCOME_LABEL[c.thread.outcome]}` : ""}
            </h3>
            <ol className="mt-2 space-y-2">
              {c.thread.messages.map((m, i) => (
                <li key={i} className={`flex ${m.from === "orbit" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === "orbit" ? "bg-panel-2 text-zinc-100" : "bg-orbit/15 text-zinc-100 ring-1 ring-inset ring-orbit/30"}`}>
                    <p className="mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500">{m.from === "orbit" ? "ORBIT" : "Proveedor"} · {m.prose === "claude" ? "Claude" : m.prose === "template" ? "plantilla" : "texto del proveedor"}</p>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    {m.invoice ? <p className="mt-1 font-mono text-xs text-zinc-400">Corregida {m.invoice.invoiceNumber} · {fmtMoney(m.invoice.amount, m.invoice.currency)}{m.invoice.payeeAccount ? ` · ${m.invoice.payeeAccount}` : ""}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
            {c.thread.guardrail && !c.thread.guardrail.ok ? (
              <ul className="mt-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
                {c.thread.guardrail.violations.map((v) => <li key={v}>• {v}</li>)}
              </ul>
            ) : null}
            {c.thread.outcomeDetail ? <p className="mt-2 text-sm text-zinc-400">{c.thread.outcomeDetail}</p> : null}
            {c.status === "negotiating" ? (
              <div className="mt-3">
                <Button variant="secondary" disabled={busy} onClick={onCobrador}>Simular la respuesta del proveedor (demo)</Button>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-zinc-500">Reglas, presupuestos y lista de beneficiarios no cambian en una negociación. La factura corregida pasó por las mismas reglas que la original.</p>
          </>
        ) : null}

        {d ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-white">Reglas de la empresa{c.thread?.outcome === "auto_resolved" ? " (factura corregida)" : ""}</h3>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {d.rules.map((r, i) => (
                <li key={i} className="flex gap-3 p-3 text-sm">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${r.pass ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>{r.pass ? "✓" : "✕"}</span>
                  <div>
                    <p className="font-medium text-zinc-100">{RULE_LABEL[r.rule] ?? r.rule} {r.code ? <ReasonChip code={r.code} /> : null}</p>
                    <p className="text-zinc-400">{r.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {c.receipt ? (
          <>
            <h3 className="mt-6 text-sm font-semibold text-white">Recibo firmado</h3>
            <p className="mt-1 text-xs text-zinc-400">
              {c.receipt.payload.action} · {fmtMoney(c.receipt.payload.amount, c.receipt.payload.currency)} · reglas <span className="font-mono">{c.receipt.payload.policyHash.slice(0, 16)}…</span> · {c.receipt.alg}
              {c.receipt.payload.ephemeral ? " · clave efímera" : ""} · verificable con <span className="font-mono">/api/keys</span>
            </p>
          </>
        ) : null}

        {c.decision?.reasons.length ? (
          <p className="mt-6 text-xs text-zinc-500">Motivos de la decisión original: {c.decision.reasons.map((r) => REASON_LABEL[r]).join(", ")}.</p>
        ) : null}
      </aside>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="truncate font-medium text-zinc-100" title={value}>{value}</dd>
    </div>
  );
}

"use client";

import { useState } from "react";
import { cobradorReply, reviewCase } from "@/lib/client/cases";
import { fmtMoney, fmtUSD, fmtWhen } from "@/lib/client/format";
import { OUTCOME_LABEL } from "@/lib/engine/labels";
import { effectiveDecision } from "@/lib/engine/ledger";
import { Button, Card, ReasonChip } from "../ui";
import { CaseDetail, StatusChip } from "./CaseDetail";
import { matchesQuery, needsPerson, useWorkspace } from "./Workspace";

/** The queue for people: escalations to approve, holds and failed negotiations to close. */
export function AprobacionesView() {
  const { cases, busy, query, run, loaded } = useWorkspace();
  const [openId, setOpenId] = useState<string>();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const queue = cases.filter((c) => needsPerson(c) && matchesQuery(c, query)).sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  const history = cases.filter((c) => c.review && matchesQuery(c, query)).sort((a, b) => b.review!.at.localeCompare(a.review!.at));
  const open = cases.find((c) => c.id === openId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-white">Aprobaciones</h1>
        <p className="text-xs text-zinc-500">Lo único que llega aquí es lo que las reglas no dejan decidir solo al agente. Solo las escaladas pueden aprobarse; lo frenado se rechaza o se corrige con el proveedor.</p>
      </div>

      {queue.length ? (
        <ul className="space-y-3">
          {queue.map((c) => {
            const d = effectiveDecision(c.decision!, c.thread);
            const canApprove = c.status === "escalated";
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button className="text-base font-semibold text-white hover:underline" onClick={() => setOpenId(c.id)}>{d.invoice.payeeName}</button>
                      <StatusChip status={c.status} />
                      {c.thread?.outcome ? <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-zinc-300">{OUTCOME_LABEL[c.thread.outcome]}</span> : null}
                    </div>
                    <p className="text-sm text-zinc-400">{d.invoice.concept} · {fmtMoney(d.invoice.amount, d.invoice.currency)}{d.invoice.currency !== "USD" ? ` (≈ ${fmtUSD(d.amountUSD)})` : ""} · {fmtWhen(c.updatedAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-1">{d.reasons.map((r) => <ReasonChip key={r} code={r} />)}</div>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-zinc-300">{d.explanation.split("\n").slice(0, 4).join("\n")}</p>
                    {c.thread?.outcomeDetail ? <p className="mt-1 text-sm text-amber-200">{c.thread.outcomeDetail}</p> : null}
                    {c.negotiationNote ? <p className="mt-1 text-sm text-amber-200">{c.negotiationNote}</p> : null}
                  </div>
                  <div className="w-full max-w-xs space-y-2">
                    <input value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} placeholder="Nota para el registro (opcional)" className="w-full rounded-md border border-line px-3 py-1.5 text-sm" />
                    <div className="flex flex-wrap gap-2">
                      {canApprove ? <Button disabled={Boolean(busy)} onClick={() => run("aprobando", async () => { await reviewCase(c.id, "approved", notes[c.id]); })}>Aprobar pago</Button> : null}
                      <Button variant="secondary" disabled={Boolean(busy)} onClick={() => run("rechazando", async () => { await reviewCase(c.id, "rejected", notes[c.id]); })}>Rechazar</Button>
                      <Button variant="ghost" onClick={() => setOpenId(c.id)}>Detalle</Button>
                    </div>
                    {!canApprove ? <p className="text-xs text-zinc-500">No se puede aprobar: una regla la frenó. El proveedor puede corregirla desde su enlace.</p> : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-zinc-500">{loaded ? "Nada pendiente. El agente está resolviendo todo dentro de las reglas." : "Cargando…"}</p>
      )}

      {history.length ? (
        <Card>
          <h2 className="text-sm font-semibold text-white">Decididas por una persona</h2>
          <ul className="mt-3 divide-y divide-line text-sm">
            {history.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <button className="text-zinc-100 hover:underline" onClick={() => setOpenId(c.id)}>{c.invoice?.payeeName} · {fmtMoney(c.invoice!.amount, c.invoice!.currency)}</button>
                <span className="text-xs text-zinc-400">
                  {c.review!.status === "approved" ? "Aprobada" : "Rechazada"} por {c.review!.by} · {fmtWhen(c.review!.at)}{c.review!.note ? ` · “${c.review!.note}”` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {open ? (
        <CaseDetail
          c={open}
          busy={Boolean(busy)}
          onClose={() => setOpenId(undefined)}
          onCobrador={() => run("respuesta del proveedor", async () => { await cobradorReply(open.id); })}
          onReview={(status, note) => run("revisión", async () => { await reviewCase(open.id, status, note); })}
        />
      ) : null}
    </div>
  );
}

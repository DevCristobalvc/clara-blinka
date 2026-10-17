"use client";

import type { Action } from "@/lib/engine/types";
import { fmtMoney, type Item } from "@/lib/client/store";
import { ACTION_STYLE, ActionBadge, ReasonChip } from "./ui";

const COLUMNS: { action: Action; title: string; hint: string }[] = [
  { action: "PAY", title: "Pagadas", hint: "Dentro de todas las reglas" },
  { action: "ESCALATE", title: "Pendientes de aprobación", hint: "Se salen de lo que el agente puede aprobar solo" },
  { action: "HOLD", title: "Frenadas", hint: "No se pagan hasta corregir" },
];

export function Board({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  if (!items.length) {
    return <p className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500">Aún no hay facturas procesadas. Ve a la Bandeja y procesa el set de demo o sube una factura.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const list = items.filter((i) => i.decision.action === col.action);
        return (
          <section key={col.action} className={`rounded-xl border p-3 ${ACTION_STYLE[col.action].column}`}>
            <header className="mb-3 flex items-baseline justify-between px-1">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{col.title}</h3>
                <p className="text-xs text-zinc-500">{col.hint}</p>
              </div>
              <span className="text-2xl font-semibold text-zinc-900">{list.length}</span>
            </header>
            <ul className="space-y-2">
              {list.map((item) => (
                <li key={item.decision.id}>
                  <button onClick={() => onOpen(item.decision.id)} className="w-full rounded-lg border border-zinc-200 bg-white p-3 text-left shadow-sm transition hover:border-zinc-400">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{item.decision.invoice.payeeName}</p>
                        <p className="truncate text-xs text-zinc-500">{item.decision.invoice.concept}</p>
                      </div>
                      <p className="shrink-0 font-mono text-xs text-zinc-700">{fmtMoney(item.decision.invoice.amount, item.decision.invoice.currency)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {item.review ? (
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${item.review.status === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-zinc-200 text-zinc-700"}`}>
                          {item.review.status === "approved" ? "Aprobada por persona" : "Rechazada por persona"}
                        </span>
                      ) : null}
                      {item.decision.reasons.map((r) => (
                        <ReasonChip key={r} code={r} />
                      ))}
                      {item.expected && item.expected.expectedAction !== item.decision.action ? (
                        <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[11px] font-medium text-violet-800">
                          esperado: <ActionBadge action={item.expected.expectedAction} />
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

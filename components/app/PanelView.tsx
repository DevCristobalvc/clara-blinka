"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Clock, Repeat, ShieldCheck, TrendingUp } from "lucide-react";
import { evaluateCases } from "@/lib/client/eval";
import { fmtMoney, fmtWhen } from "@/lib/client/format";
import { OUTCOME_LABEL, REASON_LABEL } from "@/lib/engine/labels";
import { effectiveDecision } from "@/lib/engine/ledger";
import type { Case } from "@/lib/engine/types";
import { Button, Card } from "../ui";
import { StatusChip } from "./CaseDetail";
import { Onboarding } from "./Onboarding";
import { needsPerson, useWorkspace } from "./Workspace";

function reasonFor(c: Case): string {
  if (!c.decision) return "Esperando la factura";
  if (c.thread?.outcome) return OUTCOME_LABEL[c.thread.outcome];
  if (c.review) return c.review.status === "approved" ? "Aprobada por una persona" : "Rechazada por una persona";
  const r = c.decision.reasons[0];
  return r ? REASON_LABEL[r] : "Dentro de las reglas";
}

/** "Resumen ejecutivo" + "Actividad reciente", as in the mockup, computed from the cases. */
export function PanelView() {
  const { cases, samples, loaded } = useWorkspace();
  const router = useRouter();
  const decided = cases.filter((c) => c.decision);
  const automatic = decided.filter((c) => ["paid", "scheduled", "closed"].includes(c.status));
  const pending = cases.filter(needsPerson).length;
  const ev = evaluateCases(cases, samples);
  const recent = [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);

  const kpis = [
    { value: String(decided.length), label: "Facturas procesadas", hint: "Este mes", icon: TrendingUp },
    { value: decided.length ? `${Math.round((automatic.length / decided.length) * 100)}%` : "—", label: "Decisiones automáticas", hint: "Sin intervención de una persona", icon: Repeat },
    { value: String(pending), label: "Pendientes de aprobación", hint: "Esperan a una persona", icon: Clock, accent: pending > 0 },
    { value: String(ev.unsafeAfter), label: "Pagos fuera de reglas", hint: ev.scored ? `verificado contra ${ev.scored} casos esperados` : "ninguno registrado", icon: ShieldCheck, good: true },
  ];

  return (
    <div className="space-y-6">
      <Onboarding />
      <div>
        <h1 className="text-lg font-semibold text-white">Resumen ejecutivo</h1>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ value, label, hint, icon: Icon, accent, good }) => (
            <Card key={label}>
              <div className="flex items-start justify-between">
                <span className={`text-3xl font-bold ${accent ? "text-orbit" : good ? "text-emerald-300" : "text-white"}`}>{value}</span>
                <Icon className="h-4 w-4 text-orbit" />
              </div>
              <p className="mt-3 text-sm text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500">{hint}</p>
            </Card>
          ))}
        </div>
      </div>

      <Card className="p-0">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Actividad reciente</h2>
          <Link href="/app/facturas" className="flex items-center gap-1 text-xs font-semibold text-orbit">
            Ver todas <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recent.length ? (
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-xs text-zinc-400">
              <tr>
                <th className="px-5 py-2 text-left font-medium">Fecha</th>
                <th className="text-left font-medium">Proveedor</th>
                <th className="text-left font-medium">Monto</th>
                <th className="text-left font-medium">Decisión</th>
                <th className="hidden text-left font-medium md:table-cell">Razón</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-zinc-200">
              {recent.map((c) => {
                const d = c.decision ? effectiveDecision(c.decision, c.thread) : undefined;
                return (
                  <tr key={c.id}>
                    <td className="px-5 py-2.5 text-zinc-400">{fmtWhen(c.updatedAt)}</td>
                    <td>
                      <Link href={`/app/facturas?caso=${c.id}`} className="hover:underline">{c.invoice?.payeeName ?? c.vendorHint?.name ?? "Sin proveedor"}</Link>
                    </td>
                    <td className="whitespace-nowrap pr-3 font-mono text-xs">{d ? fmtMoney(d.invoice.amount, d.invoice.currency) : "—"}</td>
                    <td><StatusChip status={c.status} className="rounded-full px-2" /></td>
                    <td className="hidden pr-5 text-zinc-400 md:table-cell">{reasonFor(c)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="px-5 pb-6 text-sm text-zinc-500">
            {loaded ? (
              <>
                <p>Aún no hay actividad. Corre el set de demo para ver al agente decidir y negociar.</p>
                <div className="mt-3">
                  <Button onClick={() => router.push("/app/facturas?demo=1")}>Correr set de demo</Button>
                </div>
              </>
            ) : (
              "Cargando…"
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

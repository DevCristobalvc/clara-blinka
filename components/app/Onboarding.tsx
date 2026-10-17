"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Circle, FileText } from "lucide-react";
import { fmtMoney } from "@/lib/client/format";
import { Button, Card } from "../ui";
import { AgentsCard } from "./AgentsCard";
import { useWorkspace } from "./Workspace";

/**
 * The story on one screen: you have invoices to pay, you hire ORBIT's pagador (pay), load its funds,
 * glance at its rules, and put it to work. Collapses to a status line once the agent is hired and busy.
 */
export function Onboarding() {
  const { cases, company, agents, pending, samples, busy, runDemoSet } = useWorkspace();
  const [open, setOpen] = useState<boolean>();

  const pagador = agents?.activations.pagador;
  const funds = Number(agents?.wallets.pagador?.balance ?? 0);
  const hired = Boolean(pagador?.active);
  const totalPending = pending.reduce((s, x) => s + x.invoice.amount * (x.invoice.currency === "USD" ? 1 : 0), 0);
  const steps = [
    { n: 1, title: "Contrata al pagador", done: hired, hint: hired ? `activo desde ${new Date(pagador!.activatedAt).toLocaleDateString("es-CO")}` : "una cuota en USDC a ORBIT, desde la wallet de tu empresa" },
    { n: 2, title: "Cárgale fondos", done: funds > 0, hint: funds > 0 ? `${funds} USDC en su wallet` : "USDC a la wallet propia del agente; de ahí paga, y solo lo que cuadre" },
    { n: 3, title: "Sus reglas", done: Boolean(company), hint: company ? `máx. USD ${company.policy.perPaymentLimitUSD.toLocaleString("es-CO")} por pago · persona sobre USD ${company.policy.humanApprovalAboveUSD.toLocaleString("es-CO")} · ${company.beneficiaries.length} proveedores` : "límites, presupuestos, proveedores permitidos", href: "/app/reglas" },
    { n: 4, title: "Ponlo a trabajar", done: cases.length > 0 && pending.length === 0, hint: cases.length ? `${cases.length} casos · ${pending.length} por procesar` : "procesa las facturas pendientes; cada una abre su caso" },
  ];
  const complete = steps.every((s) => s.done);
  const expanded = open ?? !complete;

  return (
    <Card className={expanded ? "" : "py-3"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {complete ? "ORBIT está trabajando por ti" : pending.length ? `Tienes ${pending.length} facturas por pagar${totalPending ? "" : ""}` : "Tu pagador"}
          </h2>
          <p className="text-xs text-zinc-500">
            {complete
              ? `Pagador activo · ${funds} USDC de fondos · ${cases.length} casos`
              : hired
                ? "El pagador está contratado. Ponlo a trabajar y mira cómo decide, negocia y registra."
                : "Contrata a ORBIT para que las revise, negocie lo que no cuadre y pague solo lo que debe, dentro de tus reglas."}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen(!expanded)}>{expanded ? "Ocultar" : "Ver"}</Button>
      </div>

      {expanded ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="rounded-xl border border-line bg-panel-2 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <FileText className="h-4 w-4 text-orbit" /> Facturas por pagar · {pending.length}
            </div>
            <ul className="mt-2 max-h-56 divide-y divide-line overflow-y-auto text-sm">
              {pending.slice(0, 8).map((s) => (
                <li key={s.file} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="truncate text-zinc-200">{s.invoice.payeeName} <span className="text-zinc-500">· {s.invoice.concept}</span></span>
                  <span className="shrink-0 font-mono text-xs text-zinc-300">{fmtMoney(s.invoice.amount, s.invoice.currency)}</span>
                </li>
              ))}
              {pending.length > 8 ? <li className="py-1.5 text-xs text-zinc-500">y {pending.length - 8} más</li> : null}
              {!pending.length ? <li className="py-1.5 text-xs text-zinc-500">{samples.length ? "Todas procesadas." : "Sin facturas pendientes."}</li> : null}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button disabled={!hired || !pending.length || Boolean(busy)} onClick={() => runDemoSet()}>
                {busy?.startsWith("procesando") ? busy.replace("procesando", "Procesando") + "…" : "Pon a ORBIT a trabajar"}
              </Button>
              {!hired ? <span className="text-xs text-zinc-500">primero contrata al pagador (paso 1)</span> : null}
              <Link href="/app/facturas" className="text-xs text-zinc-400 underline hover:text-white">ver casos</Link>
            </div>
          </div>

          <div>
            <ol className="grid gap-2 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.title} className={`rounded-lg border p-3 ${s.done ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-line bg-panel-2"}`}>
                  <div className="flex items-center gap-2">
                    {s.done ? <Check className="h-4 w-4 text-emerald-300" /> : <Circle className="h-4 w-4 text-zinc-500" />}
                    <p className="text-sm font-medium text-white">{s.n}. {s.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">{s.hint}</p>
                  {s.href ? <Link href={s.href} className="mt-1 inline-block text-xs text-orbit underline">{s.done ? "Revisar" : "Ir"}</Link> : null}
                </li>
              ))}
            </ol>
            <div className="mt-3">
              <AgentsCard />
            </div>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

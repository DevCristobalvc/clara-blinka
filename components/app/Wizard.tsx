"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check } from "lucide-react";
import { fmtMoney, fmtUSD } from "@/lib/client/format";
import { Button, Card } from "../ui";
import { PayButton, short } from "./AgentsCard";
import { useWorkspace } from "./Workspace";

const STEPS = ["Contrata al pagador", "Cárgale fondos", "Sus reglas", "Ponlo a trabajar"];

/**
 * Setup, one step at a time: hire the pagador (pay ORBIT), load its wallet, confirm its rules, put it
 * to work. The step is derived from the server state, so paying advances it on its own.
 */
export function Wizard() {
  const { company, agents, pending, cases, busy, run, refresh, runDemoSet } = useWorkspace();
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [rulesSeen, setRulesSeen] = useState(false);

  const pagador = agents?.activations.pagador;
  const hired = Boolean(pagador?.active);
  const funds = Number(agents?.wallets.pagador?.balance ?? 0);
  const funded = hired && funds > 0;
  const step = !hired ? 0 : !funded ? 1 : !rulesSeen ? 2 : 3;
  const onLog = (m: string) => setLog((l) => [...l.slice(-4), m]);
  const after = (label: string) => run(label, async () => { await refresh(); });

  return (
    <Card className="p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-orbit">Configura a ORBIT · {step + 1} de 4</p>
          <h2 className="text-lg font-semibold text-white">{STEPS[step]}</h2>
        </div>
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i < step ? "bg-emerald-500/20 text-emerald-300" : i === step ? "bg-orbit text-black" : "bg-panel-2 text-zinc-500"}`}>{i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className={`hidden text-xs sm:inline ${i === step ? "text-white" : "text-zinc-500"}`}>{s}</span>
              {i < STEPS.length - 1 ? <span className="mx-1 h-px w-6 bg-line" /> : null}
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          {step === 0 ? (
            <>
              <p className="text-sm text-zinc-200">Tienes <b>{pending.length} facturas por pagar</b>. El pagador las revisa contra tus reglas, negocia con el proveedor lo que no cuadre y registra solo lo que debe pagarse.</p>
              <p className="mt-2 text-sm text-zinc-400">Contratarlo es un pago de tu cuenta a ORBIT en USDC: 0,10 USDC en esta demo. Sin tarjeta, sin suscripción. Queda activo al instante.</p>
              <div className="mt-4 flex items-center gap-3">
                <PayButton label="Contratar por $0.10 USDC" demoLabel="Contratar (demo)" path="/api/agents/pagador/activate" free={Boolean(agents?.payment.free)} busy={Boolean(busy)} onLog={onLog} onDone={() => after("activando el pagador")} />
                <span className="text-xs text-zinc-500">cuota a ORBIT · {agents ? short(agents.payment.payTo) : ""}</span>
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <p className="text-sm text-zinc-200">Tu pagador está activo. Ahora cárgale fondos: USDC de tu cuenta a <b>su propia wallet</b>. Ese es el dinero que puede mover, y nada más.</p>
              <p className="mt-2 text-sm text-zinc-400">Wallet del pagador: <span className="font-mono text-zinc-200">{agents ? short(agents.wallets.pagador.address) : ""}</span>. Frena todo lo que no cuadre con tus reglas.</p>
              <div className="mt-4 flex items-center gap-3">
                <PayButton label="Cargar $1.00 USDC" demoLabel="Cargar fondos (demo)" path="/api/agents/pagador/fund" free={Boolean(agents?.payment.free)} busy={Boolean(busy)} onLog={onLog} onDone={() => after("cargando fondos")} />
              </div>
            </>
          ) : null}

          {step === 2 && company ? (
            <>
              <p className="text-sm text-zinc-200">Estas son las reglas del pagador. Las pones tú, una sola vez; el agente nunca las cambia.</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg bg-panel-2 p-4 text-sm">
                <Rule k="Máximo por pago" v={fmtUSD(company.policy.perPaymentLimitUSD)} />
                <Rule k="Aprobación humana sobre" v={fmtUSD(company.policy.humanApprovalAboveUSD)} />
                <Rule k="Presupuesto contratistas / mes" v={fmtUSD(company.policy.monthlyBudgetUSD.contractor_services ?? 0)} />
                <Rule k="Monedas" v={company.policy.allowedCurrencies.join(", ")} />
                <Rule k="Proveedores permitidos" v={`${company.beneficiaries.length}, con cuenta registrada`} />
                <Rule k="Negocia" v="contrato, moneda, duplicados, fecha" />
              </dl>
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={() => setRulesSeen(true)}>Continuar</Button>
                <Link href="/app/reglas" className="text-xs text-zinc-400 underline hover:text-white">Editar reglas</Link>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-zinc-200">Todo listo. Cada factura se vuelve un caso con su enlace: ORBIT decide, conversa con el proveedor si hace falta y registra.</p>
              <div className="mt-4 flex items-center gap-3">
                <Button disabled={!pending.length || Boolean(busy)} onClick={async () => { router.push("/app/facturas"); await runDemoSet(); }}>
                  {busy?.startsWith("procesando") ? busy.replace("procesando", "Procesando") + "…" : `Pon a ORBIT a trabajar (${pending.length})`}
                </Button>
                <span className="text-xs text-zinc-500">{cases.length ? `${cases.length} casos hasta ahora` : "procesa las facturas pendientes"}</span>
              </div>
            </>
          ) : null}

          {log.length ? <pre className="mt-4 max-h-24 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-zinc-400">{log.join("\n")}</pre> : null}
        </div>

        <div className="rounded-xl border border-line bg-panel-2 p-4">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Facturas por pagar · {pending.length}</p>
          <ul className="mt-2 max-h-52 divide-y divide-line overflow-y-auto text-sm">
            {pending.slice(0, 7).map((s) => (
              <li key={s.file} className="flex items-center justify-between gap-3 py-1.5">
                <span className="truncate text-zinc-200">{s.invoice.payeeName}</span>
                <span className="shrink-0 font-mono text-xs text-zinc-400">{fmtMoney(s.invoice.amount, s.invoice.currency)}</span>
              </li>
            ))}
            {pending.length > 7 ? <li className="py-1.5 text-xs text-zinc-500">y {pending.length - 7} más</li> : null}
          </ul>
          {hired ? (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">Confirmaciones</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li className="flex items-center justify-between gap-2 text-emerald-300">
                  <span>Pagador contratado · {pagador?.payment.amount ?? ""} USDC a ORBIT</span>
                  {pagador?.payment.transaction ? <a className="font-mono underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${pagador.payment.transaction}`}>{short(pagador.payment.transaction)}</a> : <span className="text-zinc-500">confirmando…</span>}
                </li>
                {(pagador?.funding ?? []).map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-emerald-300">
                    <span>Fondos cargados · {f.amount.replace("$", "")} USDC a la wallet del agente</span>
                    {f.transaction ? <a className="font-mono underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${f.transaction}`}>{short(f.transaction)}</a> : <span className="text-zinc-500">confirmando…</span>}
                  </li>
                ))}
                <li className="text-zinc-400">Saldo del agente: <b className="text-zinc-200">{funds} USDC</b> · wallet <span className="font-mono">{agents ? short(agents.wallets.pagador.address) : ""}</span></li>
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function Rule({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{k}</dt>
      <dd className="font-medium text-zinc-100">{v}</dd>
    </div>
  );
}

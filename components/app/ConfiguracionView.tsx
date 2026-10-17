"use client";

import { useEffect, useState } from "react";
import { resetDemo } from "@/lib/client/cases";
import type { Company } from "@/lib/engine/types";
import { BeneficiariesCard, ContractsCard } from "../RulesEditor";
import { Button, Card } from "../ui";
import { AgentsCard } from "./AgentsCard";
import { useWorkspace } from "./Workspace";

/** Setup: which agents are hired, who gets paid, what was agreed, where to report, and how to call ORBIT. */
export function ConfiguracionView() {
  const { company, savePolicy, run, busy } = useWorkspace();
  const [draft, setDraft] = useState<Company>();
  const [keys, setKeys] = useState<{ publicKey: string; ephemeral: boolean }>();
  const dirty = Boolean(draft && company && JSON.stringify(draft) !== JSON.stringify(company));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- take the server copy as the draft until the user edits
    if (company && !dirty) setDraft(company);
  }, [company, dirty]);
  useEffect(() => {
    fetch("/api/keys", { cache: "no-store" }).then((r) => r.json()).then(setKeys).catch(() => {});
  }, []);

  if (!draft) return <p className="text-sm text-zinc-500">Cargando…</p>;
  const webhook = draft.webhook ?? {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Configuración</h1>
          <p className="text-xs text-zinc-500">Una sola vez: contrata a tus agentes, registra a quién le pagas y lo acordado, y conecta tus sistemas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty || Boolean(busy)} onClick={() => setDraft(company)}>Descartar</Button>
          <Button disabled={!dirty || Boolean(busy)} onClick={() => run("guardando", async () => { await savePolicy(draft); })}>{dirty ? "Guardar cambios" : "Guardado"}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgentsCard />
        <BeneficiariesCard company={draft} onChange={setDraft} />
        <ContractsCard company={draft} />

        <Card>
          <h3 className="font-semibold text-white">Webhook</h3>
          <p className="text-xs text-zinc-500">ORBIT avisa a tus sistemas en cada cambio de un caso, con el recibo firmado y una firma HMAC (<span className="font-mono">X-Orbit-Signature</span>).</p>
          <label className="mt-3 block text-xs font-medium text-zinc-400">
            URL
            <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-sm" placeholder="https://tu-sistema.com/orbit" value={webhook.url ?? ""} onChange={(e) => setDraft({ ...draft, webhook: { ...webhook, url: e.target.value || undefined } })} />
          </label>
          <label className="mt-3 block text-xs font-medium text-zinc-400">
            Secreto compartido
            <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-sm" placeholder="opcional" value={webhook.secret ?? ""} onChange={(e) => setDraft({ ...draft, webhook: { ...webhook, secret: e.target.value || undefined } })} />
          </label>
          <p className="mt-2 text-xs text-zinc-500">Eventos: case.created · case.decided · case.negotiating · case.resolved · case.needs_human · case.reviewed · case.paid</p>
        </Card>

        <Card>
          <h3 className="font-semibold text-white">API y recibos</h3>
          <p className="text-xs text-zinc-500">Tus propios agentes pueden abrir casos y leer decisiones. Cada decisión viene firmada; verifícala con la clave pública.</p>
          <ul className="mt-3 space-y-1 font-mono text-xs text-zinc-300">
            <li>POST /api/cases → enlace de pago</li>
            <li>POST /api/cases/:id/invoice · /messages · /review</li>
            <li>GET /api/cases/:id?view=public · ?since=</li>
            <li>POST /api/decide (sin estado, guardrail para otros agentes)</li>
            <li>POST /api/agents/:agente/activate (x402)</li>
          </ul>
          {keys ? (
            <details className="mt-3 text-xs text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-300">Clave pública de los recibos (Ed25519){keys.ephemeral ? " · efímera en este despliegue" : ""}</summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-black/40 p-2 font-mono text-[11px] text-zinc-400">{keys.publicKey}</pre>
            </details>
          ) : null}
        </Card>

        <Card>
          <h3 className="font-semibold text-white">Demo</h3>
          <p className="text-xs text-zinc-500">Borra todos los casos y vuelve a la empresa ficticia de ejemplo (Andes Labs Inc.). Las activaciones y el webhook se conservan.</p>
          <div className="mt-3">
            <Button variant="secondary" disabled={Boolean(busy)} onClick={() => run("reiniciando", async () => { await resetDemo(); })}>Reiniciar demo</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

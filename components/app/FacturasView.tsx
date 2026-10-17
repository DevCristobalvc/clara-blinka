"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cobradorReply, createCase, resetDemo, reviewCase, runSample, submitInvoiceForm } from "@/lib/client/cases";
import { fmtMoney } from "@/lib/client/format";
import { OUTCOME_LABEL, STATUS_LABEL } from "@/lib/engine/labels";
import { effectiveDecision } from "@/lib/engine/ledger";
import type { Case, CaseStatus } from "@/lib/engine/types";
import { Button, Card, ReasonChip } from "../ui";
import { CaseDetail, StatusChip } from "./CaseDetail";
import { matchesQuery, useWorkspace } from "./Workspace";

const GROUPS: { title: string; hint: string; statuses: CaseStatus[]; tone: string }[] = [
  { title: "Pagadas", hint: "Dentro de las reglas, o corregidas por el proveedor", statuses: ["paid"], tone: "border-emerald-500/25 bg-emerald-500/[0.04]" },
  { title: "Con el proveedor", hint: "ORBIT negocia o programó el pago", statuses: ["negotiating", "scheduled"], tone: "border-orbit/25 bg-orbit/[0.04]" },
  { title: "Necesitan una persona", hint: "Escaladas, frenadas o sin acuerdo", statuses: ["escalated", "needs_human", "held"], tone: "border-amber-500/25 bg-amber-500/[0.04]" },
  { title: "Cerradas", hint: "Duplicados confirmados, rechazadas o esperando factura", statuses: ["closed", "rejected", "awaiting_invoice"], tone: "border-line bg-panel" },
];

/** Every payment as a case: open a link, drop a document, or run the demo set; then watch the board. */
export function FacturasView() {
  const { cases, samples, busy, query, run, loaded } = useWorkspace();
  const params = useSearchParams();
  const [openId, setOpenId] = useState<string | undefined>(params.get("caso") ?? undefined);
  const [newLink, setNewLink] = useState<string>();
  const [showNew, setShowNew] = useState(false);
  const [showSet, setShowSet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const autoRan = useRef(false);

  const done = new Set(cases.map((c) => c.source));
  const pending = samples.filter((s) => !done.has(s.file));
  const open = cases.find((c) => c.id === openId);

  async function runDemo(list = pending) {
    await run("demo", async () => {
      // One at a time: each payment updates the ledger the next invoice is checked against.
      for (const s of list) await runSample(s.file, s.invoice);
    });
  }

  // "/app/facturas?demo=1" (from an empty Panel) starts the demo once the list is known.
  useEffect(() => {
    if (params.get("demo") === "1" && loaded && !autoRan.current && pending.length && !busy) {
      autoRan.current = true;
      void runDemo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the dataset and cases are known
  }, [loaded, busy]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Facturas</h1>
          <p className="text-xs text-zinc-500">Cada pago es un caso con su enlace: eliges el proveedor y el contrato, el proveedor adjunta la factura y ORBIT decide, conversa y registra.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={Boolean(busy)} onClick={() => setShowNew((v) => !v)}>Nuevo caso</Button>
          <Button variant="secondary" disabled={Boolean(busy)} onClick={() => fileRef.current?.click()}>Subir factura</Button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              void run(`leyendo ${f.name}`, async () => {
                const { id } = await createCase({ source: f.name });
                const form = new FormData();
                form.append("file", f);
                const c = await submitInvoiceForm(id, form);
                setOpenId(c.id);
              });
              e.target.value = "";
            }}
          />
          <Button variant="secondary" disabled={Boolean(busy) || !pending.length} onClick={() => runDemo()}>
            {busy === "demo" ? "Procesando el set…" : pending.length ? `Correr set de demo (${pending.length})` : "Set de demo completo"}
          </Button>
          <Button variant="ghost" disabled={Boolean(busy)} onClick={() => run("reiniciar", async () => { await resetDemo(); setOpenId(undefined); setNewLink(undefined); })}>Reiniciar</Button>
        </div>
      </div>

      {showNew ? (
        <NewCaseForm
          busy={Boolean(busy)}
          onCancel={() => setShowNew(false)}
          onCreate={(input, file) =>
            run("abriendo caso", async () => {
              const r = await createCase(input);
              if (file) {
                const form = new FormData();
                form.append("file", file);
                await submitInvoiceForm(r.id, form);
                setOpenId(r.id);
              }
              setNewLink(r.url);
              setShowNew(false);
            })
          }
        />
      ) : null}

      {newLink ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-orbit/30 bg-orbit/5 px-4 py-3 text-sm">
          <span className="text-zinc-300">Enlace para el proveedor:</span>
          <code className="truncate font-mono text-xs text-zinc-100">{newLink}</code>
          <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(newLink)}>Copiar</Button>
          <a href={newLink} target="_blank" rel="noreferrer" className="text-xs text-zinc-300 underline hover:text-white">Abrir como proveedor</a>
          <button className="ml-auto text-xs text-zinc-500 hover:text-white" onClick={() => setNewLink(undefined)}>cerrar</button>
        </div>
      ) : null}

      {cases.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => {
            const list = cases.filter((c) => g.statuses.includes(c.status) && matchesQuery(c, query));
            return (
              <section key={g.title} className={`rounded-xl border p-3 ${g.tone}`}>
                <header className="mb-3 flex items-baseline justify-between px-1">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{g.title}</h3>
                    <p className="text-xs text-zinc-500">{g.hint}</p>
                  </div>
                  <span className="text-2xl font-semibold text-white">{list.length}</span>
                </header>
                <ul className="space-y-2">
                  {list.map((c) => {
                    const d = c.decision ? effectiveDecision(c.decision, c.thread) : undefined;
                    return (
                      <li key={c.id}>
                        <button onClick={() => setOpenId(c.id)} className="w-full rounded-lg border border-line bg-panel p-3 text-left transition hover:border-zinc-500">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">{c.invoice?.payeeName ?? c.vendorHint?.name ?? "Sin proveedor aún"}</p>
                              <p className="truncate text-xs text-zinc-500">{c.invoice?.concept ?? "Esperando la factura"}</p>
                            </div>
                            {c.invoice ? <p className="shrink-0 font-mono text-xs text-zinc-300">{fmtMoney(d?.invoice.amount ?? c.invoice.amount, d?.invoice.currency ?? c.invoice.currency)}</p> : null}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <StatusChip status={c.status} />
                            {c.thread?.outcome ? <span className="rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-zinc-300">{OUTCOME_LABEL[c.thread.outcome]}</span> : null}
                            {c.status === "negotiating" ? <span className="rounded-md bg-orbit/15 px-1.5 py-0.5 text-[11px] text-orbit">ronda {c.thread?.rounds ?? 0}/{c.thread?.maxRounds ?? 2}</span> : null}
                            {c.decision?.reasons.map((r) => <ReasonChip key={r} code={r} />)}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-sm text-zinc-500">{loaded ? "Aún no hay facturas. Corre el set de demo, sube un documento o crea un enlace de pago." : "Cargando…"}</p>
      )}

      <Card>
        <button className="flex w-full items-center justify-between text-left" onClick={() => setShowSet((v) => !v)}>
          <div>
            <h2 className="text-sm font-semibold text-white">Set de demo · {samples.length} facturas</h2>
            <p className="text-xs text-zinc-500">Empresa ficticia con casos normales, casos trampa y tres proveedores que intentan colar algo. Las respuestas de cada proveedor se simulan con reglas por proveedor.</p>
          </div>
          <span className="text-xs text-zinc-400">{showSet ? "ocultar" : "ver"}</span>
        </button>
        {showSet ? (
          <ul className="mt-4 divide-y divide-line">
            {samples.map((s) => {
              const c = cases.find((x) => x.source === s.file);
              return (
                <li key={s.file} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-100">
                      {s.invoice.payeeName} <span className="font-normal text-zinc-500">· {s.invoice.concept}</span>
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {fmtMoney(s.invoice.amount, s.invoice.currency)} · {s.expected?.note ?? s.file}{s.url ? <> · <a href={s.url} target="_blank" rel="noreferrer" className="underline hover:text-white">documento</a></> : null}
                    </p>
                  </div>
                  {c ? (
                    <button onClick={() => setOpenId(c.id)}><StatusChip status={c.status} /></button>
                  ) : (
                    <Button variant="ghost" disabled={Boolean(busy)} onClick={() => runDemo([s])}>Correr</Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : null}
      </Card>

      {open ? (
        <CaseDetail
          c={open}
          busy={Boolean(busy)}
          onClose={() => setOpenId(undefined)}
          onCobrador={() => run("respuesta del proveedor", async () => { await cobradorReply(open.id); })}
          onReview={(status, note) => run("revisión", async () => { await reviewCase(open.id, status, note); })}
        />
      ) : null}
      <p className="sr-only">{STATUS_LABEL.paid}</p>
    </div>
  );
}

/** Opening a case: who it is with and which contract it should match; optionally the invoice already received. */
function NewCaseForm({ busy, onCancel, onCreate }: { busy: boolean; onCancel: () => void; onCreate: (input: { source?: string; vendorHint: NonNullable<Case["vendorHint"]> }, file?: File) => void }) {
  const { company } = useWorkspace();
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [contractId, setContractId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File>();
  const beneficiaries = company?.beneficiaries ?? [];
  const contracts = (company?.contracts ?? []).filter((c) => !beneficiaryId || c.beneficiaryId === beneficiaryId);
  const vendor = beneficiaries.find((b) => b.id === beneficiaryId);

  return (
    <Card>
      <h2 className="text-sm font-semibold text-white">Nuevo caso de pago</h2>
      <p className="text-xs text-zinc-500">Elige el proveedor y el contrato. ORBIT abre el enlace, y desde ahí conversa con el proveedor hasta que la factura cuadre.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-zinc-400">
          Proveedor
          <select className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm" value={beneficiaryId} onChange={(e) => { setBeneficiaryId(e.target.value); setContractId(""); }}>
            <option value="">Nuevo o no registrado (ORBIT lo escalará)</option>
            {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name} · {b.country}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-400">
          Contrato
          <select className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm" value={contractId} onChange={(e) => setContractId(e.target.value)} disabled={!contracts.length}>
            <option value="">{contracts.length ? "Automático (el más cercano)" : "Sin contrato registrado"}</option>
            {contracts.map((c) => <option key={c.id} value={c.id}>{c.concept} · {fmtMoney(c.amount, c.currency)} ±{c.tolerancePct}%</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-zinc-400 sm:col-span-2">
          Nota interna (opcional)
          <input className="mt-1 w-full rounded-md border border-line px-2 py-1.5 text-sm" placeholder="Octubre, entrega 2…" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label className="block text-xs font-medium text-zinc-400 sm:col-span-2">
          ¿Ya recibiste la factura? Adjúntala y ORBIT decide de inmediato
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt" className="mt-1 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-panel-2 file:px-3 file:py-1.5 file:text-zinc-200" onChange={(e) => setFile(e.target.files?.[0])} />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <Button disabled={busy} onClick={() => onCreate({ source: file ? file.name : undefined, vendorHint: { beneficiaryId: beneficiaryId || undefined, name: vendor?.name, contractId: contractId || undefined, note: note || undefined } }, file)}>
          {file ? "Abrir caso y decidir" : "Abrir caso y crear enlace"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </Card>
  );
}

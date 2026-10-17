"use client";

import { useEffect, useRef, useState } from "react";
import type { Company, Invoice } from "@/lib/engine/types";
import { toUSD } from "@/lib/engine/fx";
import { ledger, loadState, requestDecision, saveState, fmtUSD, type AppState, type Item } from "@/lib/client/store";
import { Board } from "./Board";
import { DecisionDetail } from "./DecisionDetail";
import { Inbox, type Sample } from "./Inbox";
import { AuditLog, EvalPanel } from "./Panels";
import { RulesEditor } from "./RulesEditor";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/session";
import { OrbitLogo } from "./brand/OrbitLogo";
import { Button } from "./ui";

const TABS = [
  { id: "inbox", label: "Bandeja" },
  { id: "board", label: "Decisiones" },
  { id: "rules", label: "Reglas" },
  { id: "log", label: "Registro" },
  { id: "eval", label: "Evaluación" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const REVIEWER = "Equipo de finanzas";

export function OrbitApp({ company, samples, today }: { company: Company; samples: Sample[]; today: string }) {
  const fresh = (): AppState => ({ company, items: [], today });
  const [state, setState] = useState<AppState>(fresh);
  const [tab, setTab] = useState<Tab>("inbox");
  const [openId, setOpenId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const stateRef = useRef(state);
  const router = useRouter();

  useEffect(() => {
    const saved = loadState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the session after hydration
    if (saved) setState(saved);
  }, []);
  useEffect(() => {
    stateRef.current = state;
    saveState(state);
  }, [state]);

  const update = (fn: (s: AppState) => AppState) => {
    stateRef.current = fn(stateRef.current);
    setState(stateRef.current);
  };

  async function process(invoice: Invoice, source: string, sample?: Sample) {
    const decision = await requestDecision(stateRef.current, invoice);
    update((s) => ({ ...s, items: [...s.items, { decision, source, expected: sample?.expected }] }));
    return decision;
  }

  async function processSamples(list: Sample[]) {
    setBusy(true);
    setError(undefined);
    try {
      // One at a time: each payment updates the ledger the next invoice is checked against.
      for (const s of list) await process(s.invoice, s.file, s);
      setTab("board");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function processOne(invoice: Invoice, source: string) {
    setBusy(true);
    setError(undefined);
    try {
      const d = await process(invoice, source);
      setTab("board");
      setOpenId(d.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const review = (id: string, status: "approved" | "rejected", note: string) =>
    update((s) => ({
      ...s,
      items: s.items.map((i) => (i.decision.id === id ? { ...i, review: { status, by: REVIEWER, at: new Date().toISOString(), note: note || undefined } } : i)),
    }));

  const items = state.items;
  const paid = ledger(state);
  const paidUSD = paid.reduce((sum, p) => sum + (toUSD(p.amount, p.currency) || 0), 0);
  const pendingApproval = items.filter((i) => i.decision.action === "ESCALATE" && !i.review).length;
  const open = items.find((i) => i.decision.id === openId);

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-5">
            <h1>
              <Link href="/" aria-label="ORBIT">
                <OrbitLogo />
              </Link>
            </h1>
            <p className="hidden max-w-md border-l border-line pl-5 text-xs text-zinc-500 md:block">
              {state.company.company.name} · Actúa con autonomía. <span className="text-orbit">Nunca sin límites.</span>
            </p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Stat label="Pagado por ORBIT" value={fmtUSD(paidUSD)} />
            <Stat label="Pendientes de aprobación" value={String(pendingApproval)} highlight={pendingApproval > 0} />
            <Stat label="Procesadas" value={String(items.length)} />
            <Button
              variant="ghost"
              onClick={() => {
                update(() => fresh());
                setOpenId(undefined);
              }}
            >
              Reiniciar demo
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
                router.push("/");
              }}
            >
              Cerrar sesión
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 px-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? "border-orbit text-white" : "border-transparent text-zinc-500 hover:text-white"}`}
            >
              {t.label}
              {t.id === "board" && pendingApproval ? <span className="ml-1.5 rounded-full bg-orbit px-1.5 text-xs font-semibold text-black">{pendingApproval}</span> : null}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {error ? (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
            {error}
            <button onClick={() => setError(undefined)} className="text-xs underline">cerrar</button>
          </div>
        ) : null}
        {tab === "inbox" ? (
          <Inbox
            samples={samples}
            processedSources={new Set(items.map((i) => i.source))}
            busy={busy}
            onProcessSamples={processSamples}
            onProcessInvoice={processOne}
            onError={setError}
          />
        ) : null}
        {tab === "board" ? <Board items={items} onOpen={setOpenId} /> : null}
        {tab === "rules" ? <RulesEditor company={state.company} onChange={(c) => update((s) => ({ ...s, company: c }))} /> : null}
        {tab === "log" ? <AuditLog items={items} onOpen={setOpenId} /> : null}
        {tab === "eval" ? <EvalPanel items={items} /> : null}
      </main>

      {open ? <DecisionDetail item={open} onClose={() => setOpenId(undefined)} onReview={(status, note) => review(open.decision.id, status, note)} /> : null}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-right">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`font-semibold ${highlight ? "text-orbit" : "text-white"}`}>{value}</p>
    </div>
  );
}

export type { Item };

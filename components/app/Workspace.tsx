"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { health, listCases, runSample } from "@/lib/client/cases";
import type { AgentActivation, AgentKind, Case, Company, Expected, Invoice } from "@/lib/engine/types";

export interface AgentsState {
  activations: Partial<Record<AgentKind, AgentActivation>>;
  wallets: Record<AgentKind, { address: string; balance?: string }>;
  payment: { network: string; payTo: string; free: boolean; required: boolean };
}

/** One dataset invoice, with its ground truth when known. */
export interface SampleRow {
  file: string;
  invoice: Invoice;
  expected?: Expected;
  url?: string;
}

type Health = Awaited<ReturnType<typeof health>>;

interface WorkspaceState {
  cases: Case[];
  company?: Company;
  info?: Health;
  agents?: AgentsState;
  /** The pagador is hired (activated); until then the workspace points to the Panel's first step. */
  pagadorActive: boolean;
  samples: SampleRow[];
  busy?: string;
  error?: string;
  query: string;
  loaded: boolean;
  setQuery: (q: string) => void;
  setError: (e?: string) => void;
  refresh: () => Promise<void>;
  /** Run an action with busy/error handling, then refresh. */
  run: (label: string, fn: () => Promise<void>) => Promise<void>;
  savePolicy: (company: Company) => Promise<void>;
  /** Dataset invoices that have no case yet: the company's "facturas por pagar". */
  pending: SampleRow[];
  /** Run every pending invoice through the real flow, one at a time, refreshing after each. */
  runDemoSet: (list?: SampleRow[]) => Promise<void>;
}

const Ctx = createContext<WorkspaceState | undefined>(undefined);

async function fetchAgents(): Promise<AgentsState> {
  const res = await fetch("/api/agents", { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as AgentsState;
}

async function fetchPolicy(): Promise<Company> {
  const res = await fetch("/api/policy", { cache: "no-store" });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.company as Company;
}

/** Server-backed state for the whole workspace: cases, rules and capabilities, polled while something is in flight. */
export function WorkspaceProvider({ samples, children }: { samples: SampleRow[]; children: React.ReactNode }) {
  const [cases, setCases] = useState<Case[]>([]);
  const [company, setCompany] = useState<Company>();
  const [info, setInfo] = useState<Health>();
  const [agents, setAgents] = useState<AgentsState>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number>(undefined);

  const refresh = useCallback(async () => {
    try {
      const [c, p, a] = await Promise.all([listCases(), fetchPolicy(), fetchAgents().catch(() => undefined)]);
      setCases(c);
      setCompany(p);
      if (a) setAgents(a);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  const active = cases.some((c) => c.status === "negotiating") || Boolean(busy);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to the server's state
    void refresh();
    health().then(setInfo).catch(() => {});
    window.clearInterval(timer.current);
    timer.current = window.setInterval(() => void refresh(), active ? 3000 : 15000);
    return () => window.clearInterval(timer.current);
  }, [active, refresh]);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      setError(undefined);
      try {
        await fn();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(undefined);
        await refresh();
      }
    },
    [refresh],
  );

  const savePolicy = useCallback(
    async (next: Company) => {
      const res = await fetch("/api/policy", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCompany(body.company as Company);
    },
    [],
  );

  const done = useMemo(() => new Set(cases.map((c) => c.source)), [cases]);
  const pending = useMemo(() => samples.filter((s) => !done.has(s.file)), [samples, done]);
  const runDemoSet = useCallback(
    async (list?: SampleRow[]) => {
      const todo = list ?? pending;
      await run("demo", async () => {
        // One at a time: each payment updates the ledger the next invoice is checked against.
        for (const s of todo) {
          setBusy(`procesando ${s.invoice.payeeName}`);
          await runSample(s.file, s.invoice);
          await refresh();
        }
      });
    },
    [pending, run, refresh],
  );

  const value = useMemo<WorkspaceState>(
    () => ({ cases, company, info, agents, pagadorActive: Boolean(agents?.activations.pagador?.active), samples, busy, error, query, loaded, setQuery, setError, refresh, run, savePolicy, pending, runDemoSet }),
    [cases, company, info, agents, samples, busy, error, query, loaded, refresh, run, savePolicy, pending, runDemoSet],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}

/** Cases that need a person right now. */
export const needsPerson = (c: Case) => ["escalated", "needs_human", "held"].includes(c.status) && !c.review;

export function matchesQuery(c: Case, q: string): boolean {
  if (!q.trim()) return true;
  const hay = `${c.invoice?.payeeName ?? c.vendorHint?.name ?? ""} ${c.invoice?.invoiceNumber ?? ""} ${c.invoice?.concept ?? ""} ${c.id}`.toLowerCase();
  return hay.includes(q.trim().toLowerCase());
}

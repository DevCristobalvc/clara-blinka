"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { health, listCases } from "@/lib/client/cases";
import type { Case, Company, Expected, Invoice } from "@/lib/engine/types";

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
}

const Ctx = createContext<WorkspaceState | undefined>(undefined);

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
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);
  const timer = useRef<number>(undefined);

  const refresh = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([listCases(), fetchPolicy()]);
      setCases(c);
      setCompany(p);
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

  const value = useMemo<WorkspaceState>(
    () => ({ cases, company, info, samples, busy, error, query, loaded, setQuery, setError, refresh, run, savePolicy }),
    [cases, company, info, samples, busy, error, query, loaded, refresh, run, savePolicy],
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

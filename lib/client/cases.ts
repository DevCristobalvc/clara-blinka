import type { Case, Invoice, Review } from "@/lib/engine/types";

/** Browser-side client for the case API. Every call is server-authoritative; nothing is decided here. */

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { cache: "no-store", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body as T;
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const listCases = () => call<{ cases: Case[] }>("/api/cases").then((r) => r.cases);
export const getCase = (id: string) => call<{ case: Case }>(`/api/cases/${id}`).then((r) => r.case);
export const createCase = (input: { source?: string; vendorHint?: Case["vendorHint"] } = {}) => call<{ id: string; url: string; case: Case }>("/api/cases", json(input));
export const submitInvoice = (id: string, invoice: Invoice) => call<{ case: Case }>(`/api/cases/${id}/invoice`, json({ invoice })).then((r) => r.case);
export const submitInvoiceForm = (id: string, form: FormData) => call<{ case: Case }>(`/api/cases/${id}/invoice`, { method: "POST", body: form }).then((r) => r.case);
export const cobradorReply = (id: string) => call<{ case: Case }>(`/api/cases/${id}/messages`, json({ fromCobrador: true })).then((r) => r.case);
export const reviewCase = (id: string, status: Review["status"], note?: string) => call<{ case: Case }>(`/api/cases/${id}/review`, json({ status, note })).then((r) => r.case);
export const resetDemo = () => call<{ ok: boolean }>("/api/reset", { method: "POST" });
export const health = () => call<{ store: "memory" | "supabase"; extraction: boolean; jev: boolean; signingKey: "ephemeral" | "configured" }>("/api/health");

/** Run one dataset sample through the real flow: create → invoice → let its cobrador answer until ORBIT stops asking. */
export async function runSample(source: string, invoice: Invoice): Promise<Case> {
  const { id } = await createCase({ source, vendorHint: { name: invoice.payeeName } });
  let c = await submitInvoice(id, invoice);
  for (let i = 0; i < 4 && c.status === "negotiating"; i++) c = await cobradorReply(id);
  return c;
}

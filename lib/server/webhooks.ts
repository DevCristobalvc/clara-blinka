import { createHmac, timingSafeEqual } from "node:crypto";
import type { Case, CaseStatus, Company } from "@/lib/engine/types";
import type { CaseStore } from "./store";

export type WebhookEventType = "case.created" | "case.decided" | "case.negotiating" | "case.resolved" | "case.needs_human" | "case.reviewed" | "case.paid";

/** Which event a status transition means for the company's systems. */
export function webhookTypeFor(before: CaseStatus | undefined, after: CaseStatus): WebhookEventType | undefined {
  if (before === after) return undefined;
  if (before === undefined && after === "awaiting_invoice") return "case.created";
  if (after === "paid") return before === "negotiating" ? "case.resolved" : "case.paid";
  if (after === "negotiating") return "case.negotiating";
  if (after === "needs_human") return "case.needs_human";
  if (after === "rejected") return "case.reviewed";
  if (after === "scheduled" || after === "closed") return "case.resolved";
  return "case.decided";
}

export function signWebhook(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

export function verifyWebhook(secret: string, header: string, body: string, toleranceSec = 300, now = Date.now()): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]+)$/.exec(header);
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(now / 1000 - t) > toleranceSec) return false;
  const expected = signWebhook(secret, t, body).slice(`t=${t},v1=`.length);
  return expected.length === m[2].length && timingSafeEqual(Buffer.from(expected), Buffer.from(m[2]));
}

export interface WebhookPayload {
  id: string;
  type: WebhookEventType;
  at: string;
  case: {
    id: string;
    link?: string;
    status: CaseStatus;
    role: Case["role"];
    vendor?: string;
    invoiceNumber?: string;
    amount?: number;
    currency?: string;
    action?: Case["decision"] extends infer D ? (D extends { action: infer A } ? A : never) : never;
    reasons?: string[];
    outcome?: string;
    settlementRef?: string;
    explanation?: string;
  };
  receipt?: Case["receipt"];
}

export function webhookPayload(type: WebhookEventType, c: Case, link?: string, now = new Date().toISOString()): WebhookPayload {
  const d = c.thread?.outcome === "auto_resolved" && c.thread.finalDecision ? c.thread.finalDecision : c.decision;
  return {
    id: crypto.randomUUID(),
    type,
    at: now,
    case: {
      id: c.id,
      link,
      status: c.status,
      role: c.role,
      vendor: d?.invoice.payeeName ?? c.vendorHint?.name,
      invoiceNumber: d?.invoice.invoiceNumber,
      amount: d?.invoice.amount,
      currency: d?.invoice.currency,
      action: d?.action,
      reasons: d?.reasons,
      outcome: c.thread?.outcome,
      settlementRef: c.settlement?.ref,
      explanation: d?.explanation,
    },
    receipt: c.receipt,
  };
}

export interface EmitOptions {
  link?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

/** POST the event to the company's webhook (if any), signed, with one retry; every attempt is logged as a case event. */
export async function emitWebhook(store: CaseStore, company: Company, c: Case, type: WebhookEventType, opts: EmitOptions = {}): Promise<void> {
  const url = company.webhook?.url;
  if (!url) return;
  const payload = webhookPayload(type, c, opts.link);
  const body = JSON.stringify(payload);
  const doFetch = opts.fetch ?? fetch;
  const attempts = 1 + (opts.retries ?? 1);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const started = Date.now();
    const timestamp = Math.floor(started / 1000);
    let status: number | undefined;
    let error: string | undefined;
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Clara-Webhooks/1.0",
          "X-Clara-Event": type,
          "X-Clara-Delivery": payload.id,
          ...(company.webhook?.secret ? { "X-Clara-Signature": signWebhook(company.webhook.secret, timestamp, body) } : {}),
        },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
      });
      status = res.status;
      if (!res.ok) error = `HTTP ${res.status}`;
    } catch (err) {
      error = (err as Error).message;
    }
    await store.appendEvent({
      caseId: c.id,
      companyId: c.companyId,
      type: "webhook.attempt",
      payload: { event: type, deliveryId: payload.id, url, attempt, status, ms: Date.now() - started, error },
    });
    if (!error) return;
  }
}

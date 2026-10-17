import { after } from "next/server";
import { LedgerExecutor } from "@/lib/engine/executor";
import { PAYOUTS_ONCHAIN, WalletExecutor } from "./payout";
import { templateProse } from "@/lib/engine/negotiate";
import { claudeProse } from "@/lib/engine/vendor-prose";
import type { Case, CaseStatus, Company } from "@/lib/engine/types";
import { HttpError, type CaseDeps } from "./cases";
import { DEMO_COMPANY_ID, demoToday, ensureCompany } from "./seed";
import { ConflictError, getStore } from "./store";
import { emitWebhook, webhookTypeFor } from "./webhooks";

/** Single-tenant for the hackathon: every request acts on the demo company. */
export const COMPANY_ID = DEMO_COMPANY_ID;

export function serverDeps(): CaseDeps {
  const prose = process.env.ANTHROPIC_API_KEY && process.env.ORBIT_PROSE !== "template" ? claudeProse() : templateProse;
  // ORBIT_PAYOUTS=onchain: the pagador pays approved invoices in testnet USDC from its wallet; otherwise it records them.
  return { store: getStore(), today: demoToday(), prose, executor: PAYOUTS_ONCHAIN ? new WalletExecutor() : new LedgerExecutor() };
}

export async function companyForRequest(): Promise<Company> {
  return ensureCompany(getStore(), COMPANY_ID);
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(data: unknown, init: ResponseInit = {}): Response {
  return Response.json(data, { ...init, headers: { ...NO_STORE, ...(init.headers ?? {}) } });
}

/** Run a handler and turn thrown errors into JSON responses with the right status. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, { status: err.status });
    if (err instanceof ConflictError) return json({ error: err.message }, { status: 409 });
    if (err instanceof SyntaxError) return json({ error: "Invalid JSON body" }, { status: 400 });
    console.error(err);
    return json({ error: (err as Error).message }, { status: 500 });
  }
}

export function origin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export const caseLink = (request: Request, id: string) => `${origin(request)}/c/${id}`;

/** Notify the company's webhook about a status transition after the response has gone out. */
export function notify(request: Request, company: Company, before: CaseStatus | undefined, c: Case) {
  const type = webhookTypeFor(before, c.status);
  if (!type || !company.webhook?.url) return;
  const link = caseLink(request, c.id);
  after(() => emitWebhook(getStore(), company, c, type, { link }));
}

export async function readJson<T>(request: Request): Promise<T> {
  const body = (await request.json()) as T;
  if (!body || typeof body !== "object") throw new HttpError(400, "Body must be a JSON object");
  return body;
}

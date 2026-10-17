import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { policyHash } from "@/lib/engine/receipt";
import type { Case, Company, Receipt } from "@/lib/engine/types";

export type CaseEventType =
  | "case.created"
  | "invoice.submitted"
  | "decision"
  | "clara.message"
  | "vendor.message"
  | "correction.rejected"
  | "correction.decided"
  | "settlement"
  | "review"
  | "webhook.attempt";

export interface CaseEvent {
  id?: number;
  caseId: string;
  companyId: string;
  seq: number;
  type: CaseEventType;
  payload: unknown;
  receipt?: Receipt;
  createdAt: string;
}

export class ConflictError extends Error {
  readonly status = 409;
}

export interface ListEventsOptions {
  caseId?: string;
  type?: CaseEventType;
  /** Only events with seq greater than this (per case). */
  since?: number;
  limit?: number;
}

export interface CaseStore {
  readonly kind: "memory" | "supabase";
  getCompany(companyId: string): Promise<Company | undefined>;
  putCompany(company: Company): Promise<void>;
  createCase(c: Case): Promise<void>;
  getCase(companyId: string, id: string): Promise<Case | undefined>;
  /** Persists `c` if its version is still current, bumping the version; otherwise throws ConflictError. */
  updateCase(c: Case): Promise<Case>;
  listCases(companyId: string, limit?: number): Promise<Case[]>;
  appendEvent(event: Omit<CaseEvent, "id" | "seq" | "createdAt">): Promise<CaseEvent>;
  listEvents(companyId: string, opts?: ListEventsOptions): Promise<CaseEvent[]>;
  /** Deletes the company's cases and events (demo reset). The policy row is kept. */
  reset(companyId: string): Promise<void>;
}

const nowIso = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// In memory: tests, the offline eval and local dev without Supabase.

interface MemoryState {
  companies: Map<string, Company>;
  cases: Map<string, Case>;
  events: CaseEvent[];
}

export class MemoryStore implements CaseStore {
  readonly kind = "memory" as const;
  private readonly s: MemoryState;

  constructor(state?: MemoryState) {
    this.s = state ?? { companies: new Map(), cases: new Map(), events: [] };
  }

  async getCompany(id: string) {
    return this.s.companies.get(id);
  }
  async putCompany(company: Company) {
    if (!company.id) throw new Error("Company needs an id");
    this.s.companies.set(company.id, structuredClone(company));
  }
  async createCase(c: Case) {
    if (this.s.cases.has(c.id)) throw new ConflictError(`Case ${c.id} exists`);
    this.s.cases.set(c.id, structuredClone(c));
  }
  async getCase(companyId: string, id: string) {
    const c = this.s.cases.get(id);
    return c && c.companyId === companyId ? structuredClone(c) : undefined;
  }
  async updateCase(c: Case) {
    const current = this.s.cases.get(c.id);
    if (!current || current.version !== c.version) throw new ConflictError(`Case ${c.id} changed since it was read`);
    const next = { ...structuredClone(c), version: c.version + 1, updatedAt: nowIso() };
    this.s.cases.set(c.id, next);
    return structuredClone(next);
  }
  async listCases(companyId: string, limit = 200) {
    return [...this.s.cases.values()]
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-limit)
      .map((c) => structuredClone(c));
  }
  async appendEvent(event: Omit<CaseEvent, "id" | "seq" | "createdAt">) {
    const seq = this.s.events.filter((e) => e.caseId === event.caseId).reduce((m, e) => Math.max(m, e.seq), 0) + 1;
    const full: CaseEvent = { ...structuredClone(event), id: this.s.events.length + 1, seq, createdAt: nowIso() };
    this.s.events.push(full);
    return structuredClone(full);
  }
  async listEvents(companyId: string, { caseId, type, since, limit = 500 }: ListEventsOptions = {}) {
    return this.s.events
      .filter((e) => e.companyId === companyId && (!caseId || e.caseId === caseId) && (!type || e.type === type) && (since === undefined || e.seq > since))
      .slice(-limit)
      .map((e) => structuredClone(e));
  }
  async reset(companyId: string) {
    for (const [id, c] of this.s.cases) if (c.companyId === companyId) this.s.cases.delete(id);
    this.s.events = this.s.events.filter((e) => e.companyId !== companyId);
  }
}

// ---------------------------------------------------------------------------
// Supabase (Postgres). Schema in db/schema.sql. Service role only; never ship these env vars to the client.

interface CaseRow {
  id: string;
  company_id: string;
  role: string;
  status: string;
  version: number;
  data: Case;
  created_at: string;
  updated_at: string;
}
interface EventRow {
  id: number;
  case_id: string;
  company_id: string;
  seq: number;
  type: CaseEventType;
  payload: unknown;
  receipt: Receipt | null;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fromRow = (r: CaseRow): Case => ({ ...r.data, version: r.version, updatedAt: r.updated_at });
const fromEventRow = (r: EventRow): CaseEvent => ({ id: r.id, caseId: r.case_id, companyId: r.company_id, seq: r.seq, type: r.type, payload: r.payload, receipt: r.receipt ?? undefined, createdAt: r.created_at });

export class SupabaseStore implements CaseStore {
  readonly kind = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  static fromEnv(): SupabaseStore | undefined {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return undefined;
    return new SupabaseStore(createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  }

  private fail(where: string, error: { message: string } | null): never {
    throw new Error(`[store] ${where}: ${error?.message ?? "unknown error"}`);
  }

  async getCompany(id: string) {
    const { data, error } = await this.db.from("policies").select("body").eq("company_id", id).maybeSingle();
    if (error) this.fail("getCompany", error);
    return (data?.body as Company | undefined) ?? undefined;
  }
  async putCompany(company: Company) {
    if (!company.id) throw new Error("Company needs an id");
    const { data: current } = await this.db.from("policies").select("version").eq("company_id", company.id).maybeSingle();
    const { error } = await this.db
      .from("policies")
      .upsert({ company_id: company.id, version: (current?.version ?? 0) + 1, policy_hash: policyHash(company), body: company, updated_at: nowIso() });
    if (error) this.fail("putCompany", error);
  }
  async createCase(c: Case) {
    const { error } = await this.db
      .from("cases")
      .insert({ id: c.id, company_id: c.companyId, role: c.role, status: c.status, version: c.version, data: c, created_at: c.createdAt, updated_at: c.updatedAt });
    if (error?.code === "23505") throw new ConflictError(`Case ${c.id} exists`);
    if (error) this.fail("createCase", error);
  }
  async getCase(companyId: string, id: string) {
    if (!UUID.test(id)) return undefined; // a malformed id (e.g. a link pasted with a trailing dot) is a 404, not a Postgres error
    const { data, error } = await this.db.from("cases").select("*").eq("company_id", companyId).eq("id", id).maybeSingle();
    if (error) this.fail("getCase", error);
    return data ? fromRow(data as CaseRow) : undefined;
  }
  async updateCase(c: Case) {
    const updatedAt = nowIso();
    const next: Case = { ...c, version: c.version + 1, updatedAt };
    const { data, error } = await this.db
      .from("cases")
      .update({ status: c.status, version: next.version, data: next, updated_at: updatedAt })
      .eq("id", c.id)
      .eq("company_id", c.companyId)
      .eq("version", c.version)
      .select("id");
    if (error) this.fail("updateCase", error);
    if (!data?.length) throw new ConflictError(`Case ${c.id} changed since it was read`);
    return next;
  }
  async listCases(companyId: string, limit = 200) {
    const { data, error } = await this.db.from("cases").select("*").eq("company_id", companyId).order("created_at", { ascending: true }).limit(limit);
    if (error) this.fail("listCases", error);
    return (data as CaseRow[]).map(fromRow);
  }
  async appendEvent(event: Omit<CaseEvent, "id" | "seq" | "createdAt">) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: last } = await this.db.from("case_events").select("seq").eq("case_id", event.caseId).order("seq", { ascending: false }).limit(1).maybeSingle();
      const seq = (last?.seq ?? 0) + 1;
      const { data, error } = await this.db
        .from("case_events")
        .insert({ case_id: event.caseId, company_id: event.companyId, seq, type: event.type, payload: event.payload, receipt: event.receipt ?? null })
        .select("*")
        .single();
      if (!error) return fromEventRow(data as EventRow);
      if (error.code !== "23505") this.fail("appendEvent", error);
    }
    throw new ConflictError("Could not append event");
  }
  async listEvents(companyId: string, { caseId, type, since, limit = 500 }: ListEventsOptions = {}) {
    let q = this.db.from("case_events").select("*").eq("company_id", companyId).order("id", { ascending: true }).limit(limit);
    if (caseId) q = q.eq("case_id", caseId);
    if (type) q = q.eq("type", type);
    if (since !== undefined) q = q.gt("seq", since);
    const { data, error } = await q;
    if (error) this.fail("listEvents", error);
    return (data as EventRow[]).map(fromEventRow);
  }
  async reset(companyId: string) {
    const { error } = await this.db.from("cases").delete().eq("company_id", companyId);
    if (error) this.fail("reset", error);
  }
}

// ---------------------------------------------------------------------------

declare global {
  var __claraStore: CaseStore | undefined;
}

/** One store per process: Supabase when configured, otherwise memory (survives dev HMR via globalThis). */
export function getStore(): CaseStore {
  if (!globalThis.__claraStore) {
    const supabase = SupabaseStore.fromEnv();
    if (!supabase) console.warn("[store] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set: using the in-memory store (cases do not persist)");
    globalThis.__claraStore = supabase ?? new MemoryStore();
  }
  return globalThis.__claraStore;
}

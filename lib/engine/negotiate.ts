import { decide, type DecideOptions } from "./decide";
import { toUSD } from "./fx";
import { REASON_LABEL } from "./labels";
import { findContract, findDuplicate, matchBeneficiary, normalizeAccount } from "./rules";
import { DEFAULT_JEV_THRESHOLDS } from "./thresholds";
import {
  NEGOTIABLE_CODES,
  type Beneficiary,
  type OrbitRequest,
  type Company,
  type Contract,
  type Counterparty,
  type Decision,
  type Invoice,
  type Language,
  type NegotiationThread,
  type PaymentRecord,
  type ProseFacts,
  type ReasonCode,
  type VendorReply,
} from "./types";

/**
 * Negotiation loop. ORBIT (paying) asks the vendor's cobrador (collecting) to fix an invoice that the
 * rules held. Safety model:
 *  - only the codes in NEGOTIABLE_CODES are ever negotiated; anything else goes to a person;
 *  - the vendor's words never reach the rules: a corrected invoice is built in code from structured
 *    fields, checked by validateCorrection() and then re-run through the unchanged decide();
 *  - the prose layer only sees ProseFacts, which cannot carry the company's limits;
 *  - at most maxRounds exchanges, then a person.
 */

export const DEFAULT_MAX_ROUNDS = 2;
const NEGOTIABLE = new Set<string>(NEGOTIABLE_CODES);
const DAY_MS = 86_400_000;

export function splitReasons(reasons: ReasonCode[]): { negotiable: ReasonCode[]; blocking: ReasonCode[] } {
  return {
    negotiable: reasons.filter((r) => NEGOTIABLE.has(r)),
    blocking: reasons.filter((r) => !NEGOTIABLE.has(r)),
  };
}

export function canNegotiate(decision: Decision, company: Company): { ok: boolean; why: string } {
  if (company.policy.negotiation?.enabled === false) return { ok: false, why: "La negociación con proveedores está desactivada en las reglas." };
  if (decision.action === "PAY") return { ok: false, why: "Nada que negociar: la factura cumple las reglas." };
  if (decision.action === "ESCALATE") return { ok: false, why: "Las escalaciones las resuelve una persona, no se negocian." };
  const { blocking } = splitReasons(decision.reasons);
  if (blocking.length) {
    return { ok: false, why: `No se negocia: ${blocking.map((c) => REASON_LABEL[c].toLowerCase()).join(", ")} requiere una persona.` };
  }
  if (!decision.beneficiaryId) return { ok: false, why: "Sin beneficiario registrado no hay con quién negociar." };
  if (decision.reasons.includes("LOW_CONFIDENCE")) {
    const t = { ...DEFAULT_JEV_THRESHOLDS, ...company.policy.jev };
    const jev = decision.jev;
    const conceptLow = jev?.conceptMatchesContract !== undefined && jev.conceptMatchesContract < t.minConceptMatch;
    if (!conceptLow || jev?.risk?.score === "high") return { ok: false, why: "El modelo califica el riesgo como alto; lo revisa una persona." };
  }
  return { ok: true, why: "" };
}

export function languageFor(country: string): Language {
  const c = country.toUpperCase();
  if (c === "BR") return "pt";
  if (c === "US" || c === "GB" || c === "CA") return "en";
  return "es";
}

function addDays(iso: string, n: number): string {
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

interface Parties {
  beneficiary: Beneficiary;
  contract?: Contract;
}

function parties(decision: Decision, company: Company): Parties {
  const beneficiary = company.beneficiaries.find((b) => b.id === decision.beneficiaryId);
  if (!beneficiary) throw new Error("Cannot negotiate without a registered beneficiary");
  return { beneficiary, contract: findContract(decision.invoice, company.contracts, beneficiary.id) };
}

function baseFacts(invoice: Invoice, company: Company, { beneficiary, contract }: Parties): ProseFacts {
  return {
    language: languageFor(beneficiary.country),
    vendorName: beneficiary.name,
    companyName: company.company.name,
    invoiceNumber: invoice.invoiceNumber,
    concept: invoice.concept,
    amount: invoice.amount,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    contractConcept: contract?.concept,
  };
}

/** Which correction ORBIT asks for. Deterministic; all facts are computed here, never by a model. */
export function pickRequest(decision: Decision, company: Company, extraHistory: PaymentRecord[], today: string): OrbitRequest {
  const p = parties(decision, company);
  const history = [...company.history, ...extraHistory];
  const inv = decision.invoice;
  const facts = baseFacts(inv, company, p);
  const has = (c: ReasonCode) => decision.reasons.includes(c);
  const allowed = company.policy.allowedCurrencies.map((c) => c.toUpperCase());

  if (has("DUPLICATE")) {
    const hit = findDuplicate(inv, p.beneficiary.id, history, company.policy.duplicateWindowDays, new Date(`${today}T00:00:00Z`));
    return {
      type: "confirm_already_paid",
      facts: { ...facts, paidRecord: hit ? { invoiceNumber: hit.invoiceNumber, amount: hit.amount, currency: hit.currency, paidAt: hit.paidAt.slice(0, 10) } : undefined },
    };
  }
  const contractCurrencyDiffers = p.contract && p.contract.currency.toUpperCase() !== inv.currency.toUpperCase();
  if (has("CURRENCY_NOT_ALLOWED") || (has("CONTRACT_MISMATCH") && contractCurrencyDiffers)) {
    const preferred = [p.contract?.currency, p.beneficiary.currency, ...allowed].filter((c): c is string => !!c).map((c) => c.toUpperCase());
    const target = preferred.find((c) => allowed.includes(c)) ?? allowed[0];
    return {
      type: "reissue_in_currency",
      facts: { ...facts, targetCurrency: target, contractAmount: p.contract?.amount, contractCurrency: p.contract?.currency },
    };
  }
  if (has("CONTRACT_MISMATCH") && p.contract) {
    return { type: "reissue_at_contract_amount", facts: { ...facts, contractAmount: p.contract.amount, contractCurrency: p.contract.currency } };
  }
  if (has("DUE_TOO_FAR") && inv.dueDate) {
    return { type: "schedule_payment", facts: { ...facts, scheduledFor: addDays(inv.dueDate, -company.policy.maxDaysUntilDue) } };
  }
  return { type: "clarify_concept", facts };
}

/** Build the corrected invoice in code. The vendor's prose only lands in rawText (for JEV), never in a rule input. */
export function buildCorrected(original: Invoice, patch: VendorReply["invoice"], today: string, vendorText?: string): Invoice {
  return {
    ...original,
    amount: patch?.amount ?? original.amount,
    currency: (patch?.currency ?? original.currency).toUpperCase(),
    payeeAccount: patch?.payeeAccount ?? original.payeeAccount,
    invoiceNumber: patch?.invoiceNumber ?? original.invoiceNumber,
    concept: patch?.concept ?? original.concept,
    payeeName: original.payeeName,
    issueDate: today,
    rawText: vendorText ? `${original.rawText ? `${original.rawText}\n\n` : ""}Respuesta del proveedor: ${vendorText}` : original.rawText,
  };
}

/** A correction may only move toward the contract: same vendor, same account, never a higher amount. */
export function validateCorrection(original: Invoice, corrected: Invoice, company: Company, beneficiaryId: string, contract?: Contract): { ok: boolean; violations: string[] } {
  const v: string[] = [];
  const beneficiary = company.beneficiaries.find((b) => b.id === beneficiaryId);
  const match = matchBeneficiary(corrected, company.beneficiaries);
  if (!beneficiary || match.byName?.id !== beneficiaryId) v.push("La factura corregida no viene del mismo proveedor.");
  if (beneficiary && corrected.payeeAccount && normalizeAccount(corrected.payeeAccount) !== normalizeAccount(beneficiary.account.value)) {
    v.push(`La factura corregida trae una cuenta (${corrected.payeeAccount}) distinta a la registrada.`);
  }
  const allowed = company.policy.allowedCurrencies.map((c) => c.toUpperCase());
  if (!allowed.includes(corrected.currency.toUpperCase())) v.push(`La moneda ${corrected.currency} no está permitida.`);
  const usdC = toUSD(corrected.amount, corrected.currency);
  const usdO = toUSD(original.amount, original.currency);
  if (!Number.isFinite(usdC) || corrected.amount <= 0) v.push("El monto corregido no es válido.");
  else if (Number.isFinite(usdO) && usdC > usdO + 0.005) v.push(`El monto corregido (≈ USD ${usdC.toLocaleString("es-CO")}) es mayor que el original (≈ USD ${usdO.toLocaleString("es-CO")}).`);
  if (contract) {
    if (corrected.currency.toUpperCase() !== contract.currency.toUpperCase()) v.push(`El contrato se pacta en ${contract.currency}, la corrección viene en ${corrected.currency}.`);
    else if (corrected.amount > contract.amount) v.push(`El monto corregido (${corrected.amount.toLocaleString("es-CO")} ${corrected.currency}) sigue por encima de lo pactado (${contract.amount.toLocaleString("es-CO")} ${contract.currency}).`);
  }
  return { ok: v.length === 0, violations: v };
}

// ---------------------------------------------------------------------------
// Prose: the words around the facts. Templates always work; Claude is optional (server side).

export interface ProseWriter {
  orbit(request: OrbitRequest): Promise<{ text: string; source: "claude" | "template" }>;
  vendor(reply: VendorReply, request: OrbitRequest): Promise<{ text: string; source: "claude" | "template" }>;
}

const money = (n: number, cur: string) => `${n.toLocaleString(cur === "USD" || cur === "EUR" ? "en-US" : "es-CO", { maximumFractionDigits: 2 })} ${cur}`;

export function orbitTemplate({ type, facts: f }: OrbitRequest): string {
  const en = f.language === "en";
  const head = en
    ? `Hi ${f.vendorName}, this is ORBIT from ${f.companyName}. We received invoice ${f.invoiceNumber} for ${money(f.amount, f.currency)} (${f.concept}).`
    : `Hola ${f.vendorName}, soy ORBIT, de ${f.companyName}. Recibimos la factura ${f.invoiceNumber} por ${money(f.amount, f.currency)} (${f.concept}).`;
  switch (type) {
    case "reissue_at_contract_amount":
      return en
        ? `${head} Our agreement for "${f.contractConcept}" is ${money(f.contractAmount!, f.contractCurrency!)}. Could you reissue it for that amount, or tell us what changed? Thanks!`
        : `${head} Lo acordado por "${f.contractConcept}" es ${money(f.contractAmount!, f.contractCurrency!)}. ¿Puedes reemitirla por ese valor, o contarnos qué cambió? ¡Gracias!`;
    case "reissue_in_currency":
      return en
        ? `${head} We can only pay this vendor in ${f.targetCurrency}. Could you reissue it in ${f.targetCurrency}? Thanks!`
        : `${head} Solo podemos pagarla en ${f.targetCurrency}. ¿Puedes reemitirla en ${f.targetCurrency}? ¡Gracias!`;
    case "confirm_already_paid":
      return f.paidRecord
        ? en
          ? `${head} Our records show invoice ${f.paidRecord.invoiceNumber} for ${money(f.paidRecord.amount, f.paidRecord.currency)} was paid on ${f.paidRecord.paidAt}. Is this the same charge? If so, we'll close it without paying twice.`
          : `${head} Tenemos registrado el pago de la factura ${f.paidRecord.invoiceNumber} por ${money(f.paidRecord.amount, f.paidRecord.currency)} el ${f.paidRecord.paidAt}. ¿Es el mismo cobro? Si es así, la cerramos sin pagar dos veces.`
        : en
          ? `${head} It looks like a charge we already paid. Could you confirm?`
          : `${head} Parece un cobro que ya pagamos. ¿Nos confirmas?`;
    case "schedule_payment":
      return en
        ? `${head} It is due on ${f.dueDate}, so we have scheduled the payment for ${f.scheduledFor}. Does that work for you?`
        : `${head} Vence el ${f.dueDate}, así que la programamos para pagarla el ${f.scheduledFor}. ¿Te parece bien?`;
    case "clarify_concept":
      return en
        ? `${head} The description doesn't match what we have on contract ("${f.contractConcept ?? "no contract on file"}"). Could you tell us what it corresponds to?`
        : `${head} El concepto no coincide con lo que tenemos contratado ("${f.contractConcept ?? "sin contrato registrado"}"). ¿Nos aclaras a qué corresponde?`;
  }
}

export function vendorTemplate(reply: VendorReply, { facts: f }: OrbitRequest): string {
  const en = f.language === "en";
  const note = reply.note ? ` ${reply.note}` : "";
  const own = reply.text ? ` ${reply.text}` : "";
  switch (reply.kind) {
    case "reissue": {
      const inv = reply.invoice ?? {};
      const amt = money(inv.amount ?? f.amount, inv.currency ?? f.currency);
      return (en ? `Sure, here is the corrected invoice ${inv.invoiceNumber ?? f.invoiceNumber} for ${amt}.` : `Claro, adjunto la factura corregida ${inv.invoiceNumber ?? f.invoiceNumber} por ${amt}.`) + note + own;
    }
    case "confirm_paid":
      return (en ? `Confirmed, it is the same charge; it was already paid. Sorry for the resend.` : `Confirmado, es el mismo cobro y ya quedó pagado. Disculpen el reenvío.`) + note + own;
    case "acknowledge_schedule":
      return (en ? `Perfect, we'll expect the payment on ${f.scheduledFor}.` : `Perfecto, quedamos atentos al pago el ${f.scheduledFor}.`) + note + own;
    case "clarify":
      return (reply.note ?? (en ? "Here is the clarification." : "Te aclaro:")) + own;
    case "refuse":
      return (en ? `We can't change the invoice.` : `No podemos modificar la factura.`) + note + own;
  }
}

export const templateProse: ProseWriter = {
  async orbit(request) {
    return { text: orbitTemplate(request), source: "template" };
  },
  async vendor(reply, request) {
    return { text: vendorTemplate(reply, request), source: "template" };
  },
};

// ---------------------------------------------------------------------------
// The loop

export interface NegotiationContext {
  company: Company;
  /** Payments approved in this session, on top of company.history (same contract as DecideOptions.extraHistory). */
  extraHistory: PaymentRecord[];
  today: string;
  prose: ProseWriter;
  judge?: DecideOptions["judge"];
  now?: () => string;
  id?: () => string;
}

const nowIso = (ctx: NegotiationContext) => ctx.now?.() ?? new Date().toISOString();
const newId = (ctx: NegotiationContext) => ctx.id?.() ?? crypto.randomUUID();

async function ask(thread: NegotiationThread, request: OrbitRequest, ctx: NegotiationContext) {
  const { text, source } = await ctx.prose.orbit(request);
  thread.messages.push({ from: "orbit", at: nowIso(ctx), text, prose: source, requestType: request.type });
  thread.pendingRequest = request;
}

function finish(thread: NegotiationThread, outcome: NegotiationThread["outcome"], detail: string, extra: Partial<NegotiationThread> = {}) {
  Object.assign(thread, extra, { status: "done", outcome, outcomeDetail: detail, pendingRequest: undefined });
  return thread;
}

/** Start a thread for a HOLD that canNegotiate() approved: picks the first request and writes ORBIT's message. */
export async function openThread(decision: Decision, ctx: NegotiationContext): Promise<NegotiationThread> {
  const gate = canNegotiate(decision, ctx.company);
  if (!gate.ok) throw new Error(gate.why);
  const thread: NegotiationThread = {
    id: newId(ctx),
    originalDecisionId: decision.id,
    status: "in_progress",
    rounds: 0,
    maxRounds: ctx.company.policy.negotiation?.maxRounds ?? DEFAULT_MAX_ROUNDS,
    messages: [],
    attempts: [],
  };
  await ask(thread, pickRequest(decision, ctx.company, ctx.extraHistory, ctx.today), ctx);
  return thread;
}

/** Apply one vendor reply. Returns the thread, done or waiting on the next request. */
export async function stepThread(thread: NegotiationThread, original: Decision, reply: VendorReply, ctx: NegotiationContext): Promise<NegotiationThread> {
  if (thread.status !== "in_progress" || !thread.pendingRequest) throw new Error("Thread is not waiting on the vendor");
  const request = thread.pendingRequest;
  const current = thread.attempts.at(-1) ?? original;
  const { company, extraHistory, today } = ctx;
  const p = parties(original, company);

  const prose = reply.text && !reply.note ? { text: reply.text, source: "vendor" as const } : await ctx.prose.vendor(reply, request);
  thread.messages.push({ from: "vendor", at: nowIso(ctx), text: prose.text, prose: prose.source, replyKind: reply.kind });
  thread.rounds += 1;
  const exhausted = thread.rounds >= thread.maxRounds;

  switch (reply.kind) {
    case "refuse":
      return finish(thread, "human", "El proveedor no corrige la factura; una persona decide.");
    case "confirm_paid":
      if (request.type === "confirm_already_paid") return finish(thread, "closed", "El proveedor confirmó que la factura ya estaba pagada. No se paga de nuevo.");
      break;
    case "acknowledge_schedule":
      if (request.type === "schedule_payment") {
        return finish(thread, "scheduled", `El proveedor aceptó la fecha. Pago programado para el ${request.facts.scheduledFor}.`, { scheduledFor: request.facts.scheduledFor });
      }
      break;
    case "clarify":
      if (request.type !== "clarify_concept") break;
    // falls through: a clarification re-runs the same invoice with the vendor's explanation visible to JEV
    case "reissue": {
      const corrected = buildCorrected(current.invoice, reply.kind === "reissue" ? reply.invoice : undefined, today, prose.text);
      const guardrail = validateCorrection(original.invoice, corrected, company, p.beneficiary.id, p.contract);
      thread.guardrail = guardrail;
      if (!guardrail.ok) {
        return finish(thread, "human", `La corrección del proveedor no es aceptable: ${guardrail.violations.join(" ")} Una persona decide.`);
      }
      thread.messages.at(-1)!.invoice = corrected;
      const next = await decide(corrected, company, { today, extraHistory, judge: ctx.judge });
      thread.attempts.push(next);
      if (next.action === "PAY") {
        return finish(thread, "auto_resolved", `El proveedor corrigió la factura (${corrected.invoiceNumber}, ${money(corrected.amount, corrected.currency)}) y la versión corregida cumple todas las reglas.`, { finalDecision: next });
      }
      if (next.action === "HOLD" && canNegotiate(next, company).ok && !exhausted) {
        await ask(thread, pickRequest(next, company, extraHistory, today), ctx);
        return thread;
      }
      return finish(thread, "human", `La factura corregida sigue sin cumplir las reglas (${next.reasons.map((c) => REASON_LABEL[c].toLowerCase()).join(", ")}). Una persona decide.`, { finalDecision: next });
    }
  }
  // The reply did not answer the question asked.
  if (exhausted) return finish(thread, "human", `Se agotaron los ${thread.maxRounds} intentos sin resolver la factura. Una persona decide.`);
  await ask(thread, request, ctx);
  return thread;
}

/** Full loop against a counterparty that answers in-process (demo cobradores, eval, tests). */
export async function runNegotiation(decision: Decision, ctx: NegotiationContext, counterparty: Counterparty): Promise<NegotiationThread> {
  let thread = await openThread(decision, ctx);
  while (thread.status === "in_progress" && thread.pendingRequest) {
    const current = thread.attempts.at(-1)?.invoice ?? decision.invoice;
    const reply = await counterparty(thread.pendingRequest, current);
    thread = await stepThread(thread, decision, reply, ctx);
  }
  return thread;
}

export { effectiveDecision } from "./ledger";

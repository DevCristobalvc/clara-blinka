import { toUSD } from "./fx";
import type { Beneficiary, Company, Contract, Invoice, PaymentRecord, RuleResult } from "./types";

const DAY_MS = 86_400_000;

export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|ltd|ltda|sas|s a s|sa|s a|de cv|sa de cv|me|eireli|srl|corp|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeAccount(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeInvoiceNumber(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^0+/, "");
}

function days(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

const usd = (n: number) => `USD ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export interface BeneficiaryMatch {
  beneficiary?: Beneficiary;
  byName?: Beneficiary;
  byAccount?: Beneficiary;
}

export function matchBeneficiary(invoice: Invoice, beneficiaries: Beneficiary[]): BeneficiaryMatch {
  const account = invoice.payeeAccount ? normalizeAccount(invoice.payeeAccount) : "";
  const byAccount = account ? beneficiaries.find((b) => normalizeAccount(b.account.value) === account) : undefined;
  const name = normalizeName(invoice.payeeName);
  const byName = beneficiaries.find((b) => normalizeName(b.name) === name);
  return { beneficiary: byName ?? byAccount, byName, byAccount };
}

export function findContract(invoice: Invoice, contracts: Contract[], beneficiaryId?: string): Contract | undefined {
  if (!beneficiaryId) return undefined;
  const candidates = contracts.filter((c) => c.beneficiaryId === beneficiaryId);
  if (candidates.length <= 1) return candidates[0];
  // Several contracts with the same vendor: compare against the closest one in the invoice currency.
  return [...candidates].sort((a, b) => {
    const da = (a.currency === invoice.currency ? 0 : 1e12) + Math.abs(a.amount - invoice.amount);
    const db = (b.currency === invoice.currency ? 0 : 1e12) + Math.abs(b.amount - invoice.amount);
    return da - db;
  })[0];
}

export interface RuleContext {
  invoice: Invoice;
  company: Company;
  today: Date;
  amountUSD: number;
  match: BeneficiaryMatch;
  contract?: Contract;
  category: string;
  /** Payments already made or approved (company history plus approved decisions). */
  history: PaymentRecord[];
}

type Rule = (ctx: RuleContext) => RuleResult;

const allowlist: Rule = ({ invoice, match }) =>
  match.beneficiary
    ? { rule: "allowlist", pass: true, detail: `"${match.beneficiary.name}" está en la lista de beneficiarios permitidos.` }
    : {
        rule: "allowlist",
        pass: false,
        code: "NOT_ALLOWLISTED",
        detail: `"${invoice.payeeName}" no está en la lista de beneficiarios permitidos.`,
      };

const bankDetails: Rule = ({ invoice, match }) => {
  const { byName, byAccount } = match;
  if (!invoice.payeeAccount) {
    return {
      rule: "bank_details",
      pass: true,
      detail: match.beneficiary
        ? "La factura no trae cuenta; se pagaría a la cuenta registrada del beneficiario."
        : "La factura no trae cuenta bancaria.",
    };
  }
  if (byName && (!byAccount || byAccount.id !== byName.id)) {
    return {
      rule: "bank_details",
      pass: false,
      code: "BANK_DETAILS_CHANGED",
      detail: `La cuenta de la factura (${invoice.payeeAccount}) no coincide con la registrada para "${byName.name}" (${byName.account.value}).`,
    };
  }
  if (!byName && byAccount) {
    return {
      rule: "bank_details",
      pass: false,
      code: "BANK_DETAILS_CHANGED",
      detail: `La cuenta ${invoice.payeeAccount} pertenece a "${byAccount.name}", pero la factura viene a nombre de "${invoice.payeeName}".`,
    };
  }
  return { rule: "bank_details", pass: true, detail: "La cuenta bancaria coincide con la registrada." };
};

const currencyAllowed: Rule = ({ invoice, company, amountUSD }) => {
  const allowed = company.policy.allowedCurrencies.map((c) => c.toUpperCase());
  const cur = invoice.currency.toUpperCase();
  if (!allowed.includes(cur) || Number.isNaN(amountUSD)) {
    return {
      rule: "currency",
      pass: false,
      code: "CURRENCY_NOT_ALLOWED",
      detail: `La moneda ${cur} no está permitida (permitidas: ${allowed.join(", ")}).`,
    };
  }
  return { rule: "currency", pass: true, detail: `Moneda ${cur} permitida.` };
};

const contractMatch: Rule = ({ invoice, contract }) => {
  if (!contract) return { rule: "contract", pass: true, detail: "No hay contrato registrado para comparar el monto." };
  if (contract.currency.toUpperCase() !== invoice.currency.toUpperCase()) {
    return {
      rule: "contract",
      pass: false,
      code: "CONTRACT_MISMATCH",
      detail: `El contrato "${contract.concept}" se pacta en ${contract.currency}, pero la factura viene en ${invoice.currency}.`,
    };
  }
  const deviation = Math.abs(invoice.amount - contract.amount) / contract.amount;
  const tolerance = contract.tolerancePct / 100;
  if (deviation > tolerance) {
    return {
      rule: "contract",
      pass: false,
      code: "CONTRACT_MISMATCH",
      detail: `El monto (${invoice.amount.toLocaleString("en-US")} ${invoice.currency}) se desvía ${(deviation * 100).toFixed(1)}% de lo pactado (${contract.amount.toLocaleString("en-US")} ${contract.currency}); la tolerancia es ${contract.tolerancePct}%.`,
    };
  }
  return {
    rule: "contract",
    pass: true,
    detail: `El monto cuadra con el contrato "${contract.concept}" (desviación ${(deviation * 100).toFixed(1)}%, tolerancia ${contract.tolerancePct}%).`,
  };
};

const perPaymentLimit: Rule = ({ amountUSD, company }) => {
  const limit = company.policy.perPaymentLimitUSD;
  return amountUSD > limit
    ? { rule: "per_payment_limit", pass: false, code: "OVER_PER_PAYMENT_LIMIT", detail: `${usd(amountUSD)} supera el límite por pago de ${usd(limit)}.` }
    : { rule: "per_payment_limit", pass: true, detail: `${usd(amountUSD)} está dentro del límite por pago de ${usd(limit)}.` };
};

const humanThreshold: Rule = ({ amountUSD, company }) => {
  const threshold = company.policy.humanApprovalAboveUSD;
  return amountUSD > threshold
    ? { rule: "human_threshold", pass: false, code: "NEEDS_HUMAN_APPROVAL", detail: `Pagos sobre ${usd(threshold)} requieren aprobación humana (${usd(amountUSD)}).` }
    : { rule: "human_threshold", pass: true, detail: `Bajo el umbral de aprobación humana (${usd(threshold)}).` };
};

export function spentInMonth(history: PaymentRecord[], category: string, today: Date): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  return history
    .filter((h) => {
      const d = parseDate(h.paidAt);
      return d && d.getUTCFullYear() === y && d.getUTCMonth() === m && h.category === category;
    })
    .reduce((sum, h) => sum + (toUSD(h.amount, h.currency) || 0), 0);
}

const periodBudget: Rule = ({ amountUSD, company, category, today, history }) => {
  const budget = company.policy.monthlyBudgetUSD[category];
  if (budget === undefined) return { rule: "period_budget", pass: true, detail: `La categoría "${category}" no tiene presupuesto mensual definido.` };
  const spent = spentInMonth(history, category, today);
  const after = spent + amountUSD;
  return after > budget
    ? {
        rule: "period_budget",
        pass: false,
        code: "BUDGET_EXCEEDED",
        detail: `Presupuesto de "${category}" insuficiente: ya se gastaron ${usd(spent)} de ${usd(budget)} este mes y este pago lo llevaría a ${usd(after)}.`,
      }
    : { rule: "period_budget", pass: true, detail: `Presupuesto de "${category}": ${usd(after)} de ${usd(budget)} tras este pago.` };
};

const duplicate: Rule = ({ invoice, match, history, company, today }) => {
  const b = match.beneficiary;
  if (!b) return { rule: "duplicate", pass: true, detail: "Sin beneficiario conocido para buscar duplicados." };
  const number = normalizeInvoiceNumber(invoice.invoiceNumber);
  const ref = parseDate(invoice.issueDate) ?? today;
  const window = company.policy.duplicateWindowDays;
  const hit = history.find((h) => {
    if (h.beneficiaryId !== b.id) return false;
    if (number && normalizeInvoiceNumber(h.invoiceNumber) === number) return true;
    // Recurring fixed fees repeat the amount every month, so compare invoice issue dates, not payment dates.
    const prev = parseDate(h.issueDate ?? h.paidAt);
    return (
      h.amount === invoice.amount &&
      h.currency.toUpperCase() === invoice.currency.toUpperCase() &&
      prev !== undefined &&
      Math.abs(days(prev, ref)) <= window
    );
  });
  return hit
    ? {
        rule: "duplicate",
        pass: false,
        code: "DUPLICATE",
        detail: `Posible cobro duplicado: ya se pagó la factura ${hit.invoiceNumber} a "${b.name}" por ${hit.amount.toLocaleString("en-US")} ${hit.currency} el ${hit.paidAt.slice(0, 10)}.`,
      }
    : { rule: "duplicate", pass: true, detail: "No hay pagos previos que coincidan (número de factura o mismo monto reciente)." };
};

const dueDate: Rule = ({ invoice, company, today }) => {
  const due = parseDate(invoice.dueDate);
  if (!due) return { rule: "due_date", pass: true, detail: "La factura no indica fecha de vencimiento." };
  const left = days(today, due);
  if (left < 0) return { rule: "due_date", pass: false, code: "PAST_DUE", detail: `La factura venció hace ${-left} día(s) (${invoice.dueDate}).` };
  if (left > company.policy.maxDaysUntilDue) {
    return {
      rule: "due_date",
      pass: false,
      code: "DUE_TOO_FAR",
      detail: `Vence en ${left} días (${invoice.dueDate}); la política solo paga con hasta ${company.policy.maxDaysUntilDue} días de anticipación.`,
    };
  }
  return { rule: "due_date", pass: true, detail: `Vence en ${left} día(s) (${invoice.dueDate}).` };
};

export const RULES: Rule[] = [
  allowlist,
  bankDetails,
  currencyAllowed,
  contractMatch,
  perPaymentLimit,
  humanThreshold,
  periodBudget,
  duplicate,
  dueDate,
];

export function runRules(ctx: RuleContext): RuleResult[] {
  return RULES.map((rule) => rule(ctx));
}

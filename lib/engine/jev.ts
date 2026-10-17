import type { Beneficiary, Contract, Invoice, JevAnswers, JevThresholds } from "./types";

export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";

export const DEFAULT_JEV_THRESHOLDS: JevThresholds = {
  minConceptMatch: 0.5,
  maxSocialEngineering: 0.7,
  minConfidence: 0.3,
};

export const EXPENSE_CATEGORIES: Record<string, string> = {
  contractor_services: "Professional services by an individual contractor or agency (development, design, consulting)",
  software: "Software subscriptions, SaaS, cloud hosting, licenses",
  office: "Office rent, coworking, utilities, equipment, supplies",
  marketing: "Advertising, events, content, PR, sponsorships",
  legal_accounting: "Legal, accounting, tax, payroll or compliance services",
  travel: "Flights, hotels, transport, meals while travelling",
  other: "An expense that fits none of the above",
};

const RISK_LEVELS = [
  "Routine invoice, consistent with a normal vendor relationship",
  "Some unusual elements that deserve a second look",
  "Strong signs of error, fraud or manipulation",
];

export interface JudgeInput {
  invoice: Invoice;
  beneficiary?: Beneficiary;
  contract?: Contract;
}

/** The text JEV evaluates. Facts only: no arithmetic or date comparisons are asked of the model. */
export function buildState({ invoice, beneficiary, contract }: JudgeInput): string {
  const lines = [
    "INVOICE",
    `Payee: ${invoice.payeeName}`,
    invoice.payeeAccount ? `Bank account on invoice: ${invoice.payeeAccount}` : "",
    `Invoice number: ${invoice.invoiceNumber}`,
    `Concept: ${invoice.concept}`,
    `Amount: ${invoice.amount} ${invoice.currency}`,
    invoice.issueDate ? `Issue date: ${invoice.issueDate}` : "",
    invoice.dueDate ? `Due date: ${invoice.dueDate}` : "",
    invoice.channel ? `Received via: ${invoice.channel}` : "",
    invoice.rawText ? `Message text:\n${invoice.rawText.slice(0, 6000)}` : "",
    "",
    "COMPANY RECORDS",
    beneficiary ? `Registered vendor: ${beneficiary.name} (${beneficiary.category}, ${beneficiary.country})` : "Vendor is not registered.",
    contract ? `Agreed contract: "${contract.concept}", ${contract.amount} ${contract.currency}, ${contract.frequency}` : "No contract on file.",
  ];
  return lines.filter((l) => l !== "").join("\n");
}

export function buildQuestions(input: JudgeInput) {
  const questions: Record<string, unknown> = {
    urgency_pressure: {
      type: "noul",
      instructions: "Does the message pressure the company to pay urgently or outside its normal process?",
      criteria: {
        true: "Demands immediate payment, threatens consequences, asks for secrecy or to skip approvals",
        false: "Ordinary tone, normal payment terms",
      },
    },
    bank_change_request: {
      type: "noul",
      instructions: "Does the message ask to send the payment to a new or different bank account?",
    },
    expense_category: {
      type: "choice",
      instructions: "Which expense category does this invoice belong to?",
      criteria: EXPENSE_CATEGORIES,
    },
    risk_level: {
      type: "score",
      instructions: "How risky is it to pay this invoice as it is?",
      criteria: RISK_LEVELS,
    },
  };
  if (input.contract) {
    questions.concept_matches_contract = {
      type: "noul",
      instructions: `Does the invoice charge for the same service or goods as the agreed contract: "${input.contract.concept}"?`,
      criteria: {
        true: "Same service or goods, even if worded differently",
        false: "A different, additional or unrelated service or goods",
      },
    };
  }
  return questions;
}

interface JevResponse {
  model: string;
  answers: Record<string, { type: string; noul?: number; choice?: string; score?: number; confidence?: number }>;
}

export async function judgeWithJev(input: JudgeInput, apiKey: string, timeoutMs = 4000): Promise<JevAnswers> {
  const started = Date.now();
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state: buildState(input), model: JEV_MODEL, questions: buildQuestions(input) }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`JEV ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as JevResponse;
  const a = data.answers;
  const riskScore = a.risk_level?.score ?? 0;
  return {
    source: "jev",
    model: data.model,
    latencyMs: Date.now() - started,
    conceptMatchesContract: a.concept_matches_contract?.noul,
    socialEngineering: Math.max(a.urgency_pressure?.noul ?? 0, a.bank_change_request?.noul ?? 0),
    category: a.expense_category?.choice
      ? { choice: a.expense_category.choice, confidence: a.expense_category.confidence ?? 0 }
      : undefined,
    risk: { score: riskLabel(riskScore), confidence: a.risk_level?.confidence ?? 0 },
  };
}

function riskLabel(score: number): string {
  return score >= 1.5 ? "high" : score >= 0.75 ? "medium" : "low";
}

// ---------------------------------------------------------------------------
// Offline fallback: keyword heuristics so the demo works without an API key.
// Always marked source: "offline" in the decision log.

const URGENCY = /\b(urgent[e]?|urgently|asap|immediately|inmediat[oa]|de inmediato|hoy mismo|ya mismo|today|antes de las|confidencial|confidential|no (le )?(digas|comentes)|skip|sin aprobaci[oó]n|sin pasar por|ahora mismo|last chance|última oportunidad)\b/i;
const BANK_CHANGE = /(nueva cuenta|cuenta nueva|new (bank )?account|cambi(amos|o|ó) (de )?(banco|cuenta)|chang(ed|e) (our )?(bank|account)|actualiz(ar|amos|en) (la |nuestra )?cuenta|different account|otra cuenta|update (our )?(bank|banking) details|nuevos datos bancarios|novos dados banc[aá]rios|nova conta)/i;

const STOPWORDS = new Set(
  "de la el los las y en por para con del al a un una of the and for to in on services servicio servicios mensual monthly fee".split(" "),
);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t)),
  );
}

function overlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / Math.min(ta.size, tb.size);
}

const CATEGORY_HINTS: [string, RegExp][] = [
  ["software", /(saas|software|licen|subscription|suscripci|hosting|cloud|aws|api)/i],
  ["office", /(arriendo|rent|cowork|oficina|office|internet|energ|utilities)/i],
  ["marketing", /(marketing|ads|publicidad|campaign|campaña|evento|event|contenido|content)/i],
  ["legal_accounting", /(legal|abogad|contab|account|tax|impuesto|nómina|payroll|audit)/i],
  ["travel", /(vuelo|flight|hotel|viaje|travel|uber|taxi)/i],
  ["contractor_services", /(desarroll|develop|diseñ|design|consult|freelance|contractor|honorarios|horas|hours)/i],
];

export function judgeOffline({ invoice, contract }: JudgeInput): JevAnswers {
  const started = Date.now();
  const text = `${invoice.concept}\n${invoice.rawText ?? ""}`;
  const urgency = URGENCY.test(text) ? 0.85 : 0.1;
  const bankChange = BANK_CHANGE.test(text) ? 0.9 : 0.05;
  const category = CATEGORY_HINTS.find(([, re]) => re.test(text))?.[0] ?? "other";
  const conceptMatch = contract ? Math.min(0.95, 0.15 + overlap(invoice.concept, contract.concept)) : undefined;
  const social = Math.max(urgency, bankChange);
  return {
    source: "offline",
    latencyMs: Date.now() - started,
    conceptMatchesContract: conceptMatch,
    socialEngineering: social,
    category: { choice: category, confidence: category === "other" ? 0.3 : 0.7 },
    risk: { score: social > 0.5 ? "high" : conceptMatch !== undefined && conceptMatch < 0.5 ? "medium" : "low", confidence: 0.5 },
  };
}

export async function judge(input: JudgeInput, apiKey = process.env.TYPESAFE_API_KEY): Promise<JevAnswers> {
  if (!apiKey) return judgeOffline(input);
  try {
    return await judgeWithJev(input, apiKey);
  } catch (err) {
    // Never block a decision on the judgment service: fall back and say so in the log.
    console.error("[jev] falling back to offline heuristics:", (err as Error).message);
    return judgeOffline(input);
  }
}

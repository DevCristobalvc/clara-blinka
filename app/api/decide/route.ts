import { decide } from "@/lib/engine/decide";
import type { Company, Invoice, PaymentRecord } from "@/lib/engine/types";

interface DecideBody {
  invoice: Invoice;
  company: Company;
  extraHistory?: PaymentRecord[];
  today?: string;
}

/**
 * Stateless decision endpoint: the caller sends the invoice plus the company's rules and ledger,
 * Clara answers PAY | HOLD | ESCALATE with reasons. Other agents can use it as a payment guardrail.
 */
export async function POST(request: Request) {
  let body: DecideBody;
  try {
    body = (await request.json()) as DecideBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.invoice || !body?.company?.policy) {
    return Response.json({ error: "Body must include invoice and company" }, { status: 400 });
  }
  try {
    const decision = await decide(body.invoice, body.company, { today: body.today, extraHistory: body.extraHistory });
    return Response.json(decision);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

import { isAgentKind } from "@/lib/server/agents";
import { HttpError } from "@/lib/server/cases";
import { companyForRequest, handle, json, readJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/**
 * The settlement hash exists only after the paid handler responded, so the client reports it back here
 * (from the PAYMENT-RESPONSE header) and it is attached to the latest activation or funding entry.
 */
export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  return handle(async () => {
    const { kind } = await params;
    if (!isAgentKind(kind)) throw new HttpError(404, "Unknown agent");
    const body = await readJson<{ action?: "activate" | "fund"; transaction?: string; payer?: string }>(request);
    if (!body.transaction || !/^0x[0-9a-f]{64}$/i.test(body.transaction)) throw new HttpError(400, "transaction must be a 0x-prefixed 32-byte hash");
    const company = await companyForRequest();
    const a = company.agents?.[kind];
    if (!a) throw new HttpError(409, "Nothing to attach the transaction to");
    if (body.action === "fund") {
      const last = a.funding?.at(-1);
      if (!last) throw new HttpError(409, "No funding recorded");
      last.transaction = body.transaction;
    } else {
      a.payment.transaction = body.transaction;
    }
    await getStore().putCompany({ ...company, agents: { ...company.agents, [kind]: a } });
    return json({ ok: true, activation: a });
  });
}

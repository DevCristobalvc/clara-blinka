import { policyHash } from "@/lib/engine/receipt";
import type { Company } from "@/lib/engine/types";
import { HttpError } from "@/lib/server/cases";
import { COMPANY_ID, companyForRequest, handle, json, readJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** The company's setup: rules, beneficiaries, contracts, history and webhook. */
export async function GET() {
  return handle(async () => {
    const company = await companyForRequest();
    return json({ company, policyHash: policyHash(company) });
  });
}

/** Replace the setup. Rule changes are the one thing the agent can never do on its own; this is the human path. */
export async function PUT(request: Request) {
  return handle(async () => {
    const token = process.env.CLARA_ADMIN_TOKEN;
    if (token && request.headers.get("x-clara-admin") !== token) throw new HttpError(401, "Missing or invalid admin token");
    const body = await readJson<Partial<Company>>(request);
    if (!body.policy || !Array.isArray(body.beneficiaries) || !Array.isArray(body.contracts)) {
      throw new HttpError(400, "Body must include policy, beneficiaries and contracts");
    }
    const current = await companyForRequest();
    const next: Company = { ...current, ...body, id: COMPANY_ID, history: body.history ?? current.history, webhook: body.webhook ?? current.webhook };
    await getStore().putCompany(next);
    return json({ company: next, policyHash: policyHash(next) });
  });
}

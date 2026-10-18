import type { Case } from "@/lib/engine/types";
import { REQUIRE_ACTIVATION, agentActive } from "@/lib/server/agents";
import { createCase, HttpError } from "@/lib/server/cases";
import { caseLink, COMPANY_ID, companyForRequest, handle, json, notify, serverDeps } from "@/lib/server/http";
import { sendInvite } from "@/lib/server/invite";

/** The company's view of every case, newest last. */
export async function GET() {
  return handle(async () => {
    const deps = serverDeps();
    await companyForRequest();
    return json({ cases: await deps.store.listCases(COMPANY_ID) });
  });
}

interface CreateBody {
  role?: Case["role"];
  source?: string;
  vendorHint?: Case["vendorHint"];
  /** Send the link to the vendor on creation (default true when the vendor is known). */
  invite?: boolean;
}

/** Open a case and get the link the vendor (or its cobrador agent) will use. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = request.headers.get("content-type")?.includes("json") ? ((await request.json()) as CreateBody) : {};
    const deps = serverDeps();
    const company = await companyForRequest();
    if (REQUIRE_ACTIVATION && !agentActive(company, "pagador")) throw new HttpError(403, "Activa el agente pagador en Configuración antes de abrir casos");
    let c = await createCase(deps, COMPANY_ID, body);
    const url = caseLink(request, c.id);
    // The vendor gets the link right away (email if configured, recorded otherwise) unless the caller opts out.
    if (body.invite !== false) c = await sendInvite(deps.store, company, c, url);
    notify(request, company, undefined, c);
    return json({ id: c.id, url, case: c }, { status: 201 });
  });
}

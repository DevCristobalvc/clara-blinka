import type { Case } from "@/lib/engine/types";
import { REQUIRE_ACTIVATION, agentActive } from "@/lib/server/agents";
import { createCase, HttpError } from "@/lib/server/cases";
import { caseLink, COMPANY_ID, companyForRequest, handle, json, notify, serverDeps } from "@/lib/server/http";

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
}

/** Open a case and get the link the vendor (or its cobrador agent) will use. */
export async function POST(request: Request) {
  return handle(async () => {
    const body = request.headers.get("content-type")?.includes("json") ? ((await request.json()) as CreateBody) : {};
    const deps = serverDeps();
    const company = await companyForRequest();
    if (REQUIRE_ACTIVATION && !agentActive(company, "pagador")) throw new HttpError(403, "Activa el agente pagador en Configuración antes de abrir casos");
    const c = await createCase(deps, COMPANY_ID, body);
    notify(request, company, undefined, c);
    return json({ id: c.id, url: caseLink(request, c.id), case: c }, { status: 201 });
  });
}

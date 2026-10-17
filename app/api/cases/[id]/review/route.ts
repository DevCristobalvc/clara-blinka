import type { Review } from "@/lib/engine/types";
import { HttpError, reviewCase } from "@/lib/server/cases";
import { COMPANY_ID, companyForRequest, handle, json, notify, readJson, serverDeps } from "@/lib/server/http";

/** A person approves (escalations only) or rejects a case. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const body = await readJson<{ status?: Review["status"]; by?: string; note?: string }>(request);
    if (body.status !== "approved" && body.status !== "rejected") throw new HttpError(400, "status must be approved or rejected");
    const deps = serverDeps();
    const company = await companyForRequest();
    const before = (await deps.store.getCase(COMPANY_ID, id))?.status;
    const c = await reviewCase(deps, COMPANY_ID, id, { status: body.status, by: body.by?.trim() || "Equipo de finanzas", note: body.note });
    notify(request, company, before, c);
    return json({ case: c });
  });
}

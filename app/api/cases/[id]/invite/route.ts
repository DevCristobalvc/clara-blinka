import { HttpError } from "@/lib/server/cases";
import { caseLink, COMPANY_ID, companyForRequest, handle, json, serverDeps } from "@/lib/server/http";
import { sendInvite } from "@/lib/server/invite";

/** (Re)send the case link to the vendor. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const deps = serverDeps();
    const company = await companyForRequest();
    const c = await deps.store.getCase(COMPANY_ID, id);
    if (!c) throw new HttpError(404, "Case not found");
    const sent = await sendInvite(deps.store, company, c, caseLink(request, c.id));
    if (!sent.invite) throw new HttpError(409, "This case has no registered vendor to send the link to");
    return json({ case: sent });
  });
}

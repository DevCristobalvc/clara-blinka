import { HttpError, publicCase } from "@/lib/server/cases";
import { COMPANY_ID, companyForRequest, handle, json, serverDeps } from "@/lib/server/http";

/**
 * One case. `?view=public` is what the vendor's link shows (no rule details, no policy);
 * `?since=<seq>` returns only events newer than that, for polling.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const url = new URL(request.url);
    const deps = serverDeps();
    const company = await companyForRequest();
    const c = await deps.store.getCase(COMPANY_ID, id);
    if (!c) throw new HttpError(404, "Case not found");
    const since = url.searchParams.get("since");
    const events = await deps.store.listEvents(COMPANY_ID, { caseId: id, since: since ? Number(since) : undefined });
    const isPublic = url.searchParams.get("view") === "public";
    return json({
      case: isPublic ? publicCase(c, company) : c,
      events: isPublic ? events.filter((e) => e.type !== "webhook.attempt").map((e) => ({ ...e, receipt: undefined })) : events,
    });
  });
}

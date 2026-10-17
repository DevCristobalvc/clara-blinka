import { extractInvoice } from "@/lib/engine/extract";
import type { Invoice } from "@/lib/engine/types";
import { HttpError, submitInvoice } from "@/lib/server/cases";
import { COMPANY_ID, companyForRequest, handle, json, notify, serverDeps } from "@/lib/server/http";
import { sourceFromForm } from "@/lib/server/invoice-source";

/**
 * The vendor attaches the invoice: a file or pasted text (multipart, extracted by Claude) or an
 * already-structured `{ invoice }` (JSON, for cobrador agents and the demo).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    let invoice: Invoice;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "Extraction is not configured (missing ANTHROPIC_API_KEY); send a structured invoice instead");
      invoice = await extractInvoice(await sourceFromForm(await request.formData()));
    } else {
      const body = (await request.json()) as { invoice?: Invoice };
      if (!body?.invoice?.payeeName || typeof body.invoice.amount !== "number" || !body.invoice.currency) {
        throw new HttpError(400, "Body must include an invoice with payeeName, amount and currency");
      }
      invoice = body.invoice;
    }
    const deps = serverDeps();
    const company = await companyForRequest();
    const before = (await deps.store.getCase(COMPANY_ID, id))?.status;
    const c = await submitInvoice(deps, COMPANY_ID, id, invoice);
    notify(request, company, before, c);
    return json({ case: c });
  });
}

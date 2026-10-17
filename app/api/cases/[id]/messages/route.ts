import { readFileSync } from "node:fs";
import path from "node:path";
import { cobradorFor, cobradorReply, type CobradorConfig } from "@/lib/engine/cobrador";
import { extractInvoice } from "@/lib/engine/extract";
import { findContract } from "@/lib/engine/rules";
import type { VendorReply } from "@/lib/engine/types";
import { HttpError, postVendorReply } from "@/lib/server/cases";
import { COMPANY_ID, companyForRequest, handle, json, notify, serverDeps } from "@/lib/server/http";
import { sourceFromForm } from "@/lib/server/invoice-source";

interface MessageBody extends Partial<VendorReply> {
  /** Demo: let the simulated vendor (rule-driven, from data/cobradores.json) answer instead of a person. */
  fromCobrador?: boolean;
}

function cobradorOverrides(): Record<string, Partial<CobradorConfig>> {
  try {
    return (JSON.parse(readFileSync(path.join(process.cwd(), "data", "cobradores.json"), "utf8")) as { byFile: Record<string, Partial<CobradorConfig>> }).byFile;
  } catch {
    return {};
  }
}

const KINDS = new Set<VendorReply["kind"]>(["reissue", "confirm_paid", "acknowledge_schedule", "clarify", "refuse"]);

/**
 * The vendor answers ORBIT's request. Three ways in: a structured JSON reply (`kind`, `invoice`, `text`),
 * a corrected document as multipart (extracted, then treated as a reissue), or `fromCobrador: true`
 * so the vendor's own agent answers by its rules (demo).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const deps = serverDeps();
    const company = await companyForRequest();
    const current = await deps.store.getCase(COMPANY_ID, id);
    if (!current) throw new HttpError(404, "Case not found");

    let reply: VendorReply;
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "Extraction is not configured (missing ANTHROPIC_API_KEY); send a structured reply instead");
      const form = await request.formData();
      const corrected = await extractInvoice(await sourceFromForm(form));
      reply = {
        kind: "reissue",
        invoice: { amount: corrected.amount, currency: corrected.currency, payeeAccount: corrected.payeeAccount, invoiceNumber: corrected.invoiceNumber, concept: corrected.concept },
        text: typeof form.get("message") === "string" ? String(form.get("message")) : corrected.rawText,
      };
    } else {
      const body = (await request.json()) as MessageBody;
      if (body.fromCobrador) {
        if (!current.decision || !current.thread?.pendingRequest) throw new HttpError(409, "This case is not waiting on the vendor");
        const b = company.beneficiaries.find((x) => x.id === current.decision!.beneficiaryId);
        if (!b) throw new HttpError(409, "No registered vendor to answer for");
        const cfg = cobradorFor(b, findContract(current.invoice!, company.contracts, b.id), current.source ? cobradorOverrides()[current.source] : undefined);
        const invoice = current.thread.attempts.at(-1)?.invoice ?? current.invoice!;
        reply = cobradorReply(cfg, current.thread.pendingRequest, invoice);
      } else {
        if (!body.kind || !KINDS.has(body.kind)) throw new HttpError(400, `kind must be one of ${[...KINDS].join(", ")}`);
        reply = { kind: body.kind, invoice: body.invoice, note: body.note, text: body.text };
      }
    }

    const c = await postVendorReply(deps, COMPANY_ID, id, reply);
    notify(request, company, current.status, c);
    return json({ case: c });
  });
}

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Invoice } from "./types";

export const EXTRACTION_MODEL = "claude-opus-5-5";

const ExtractedInvoice = z.object({
  payeeName: z.string().describe("Who is charging (person or company) exactly as written"),
  payeeAccount: z.string().nullable().describe("Bank account / IBAN / CLABE / PIX key to pay, exactly as written, or null"),
  invoiceNumber: z.string().describe("Invoice or charge number; empty string if none"),
  issueDate: z.string().nullable().describe("Issue date as YYYY-MM-DD, or null"),
  dueDate: z.string().nullable().describe("Due date as YYYY-MM-DD, or null"),
  currency: z.string().describe("ISO 4217 code: USD, COP, MXN, BRL, ARS, EUR..."),
  amount: z.number().describe("Total amount to pay in that currency, as a plain number"),
  concept: z.string().describe("Short description of what is being charged"),
  notes: z.string().nullable().describe("Free-text remarks or payment instructions on the document, verbatim, or null"),
});

const SYSTEM = `You extract invoice data for a company's accounts-payable team.
Copy what the document says; never guess or correct amounts, accounts or dates.
Amounts are plain numbers in the invoice currency (no thousands separators).
You only extract. Whether to pay is decided elsewhere, so do not comment on it.`;

export type InvoiceSource =
  | { kind: "pdf"; base64: string }
  | { kind: "image"; base64: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif" }
  | { kind: "text"; text: string; channel: "email" | "chat" | "text" };

function contentFor(source: InvoiceSource): Anthropic.ContentBlockParam[] {
  const ask: Anthropic.TextBlockParam = { type: "text", text: "Extract the invoice fields." };
  switch (source.kind) {
    case "pdf":
      return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: source.base64 } }, ask];
    case "image":
      return [{ type: "image", source: { type: "base64", media_type: source.mediaType, data: source.base64 } }, ask];
    case "text":
      return [{ type: "text", text: `Message received via ${source.channel}:\n\n${source.text}` }, ask];
  }
}

export async function extractInvoice(source: InvoiceSource, client = new Anthropic()): Promise<Invoice> {
  const response = await client.beta.messages.parse({
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // re-run on Anthropic's recommended model if a safety classifier declines
    model: EXTRACTION_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: "user", content: contentFor(source) }],
    output_config: { effort: "low", format: zodOutputFormat(ExtractedInvoice) },
  });
  if (response.stop_reason === "refusal") throw new Error("Extraction declined by the model");
  const out = response.parsed_output;
  if (!out) throw new Error(`Extraction failed (stop_reason: ${response.stop_reason})`);

  const channel = source.kind === "text" ? source.channel : source.kind;
  const rawText = [source.kind === "text" ? source.text : "", out.notes ?? ""].filter(Boolean).join("\n\n");
  return {
    payeeName: out.payeeName,
    payeeAccount: out.payeeAccount ?? undefined,
    invoiceNumber: out.invoiceNumber,
    issueDate: out.issueDate ?? undefined,
    dueDate: out.dueDate ?? undefined,
    currency: out.currency.toUpperCase(),
    amount: out.amount,
    concept: out.concept,
    channel,
    rawText: rawText || undefined,
  };
}

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { orbitTemplate, vendorTemplate, type ProseWriter } from "./negotiate";
import type { OrbitRequest, VendorReply } from "./types";

/**
 * Natural-language wording for negotiation messages, on top of the engine's facts. Server-only.
 * The model only writes words: it never chooses the request, the amounts or the outcome, and it
 * only ever sees ProseFacts (no limits, budgets or thresholds). Any failure falls back to templates.
 */

export const PROSE_MODEL = "claude-haiku-5-5";

const Message = z.object({ message: z.string().max(700).describe("The message text, 2–4 sentences, no subject line, no signature block") });

const LANG = { es: "Spanish (Latin American, tuteo)", en: "English", pt: "Brazilian Portuguese" } as const;

const CLARA_SYSTEM = `You write short, courteous messages on behalf of ORBIT, the accounts-payable agent of a company, to one of its vendors.
Use ONLY the facts given. Never invent amounts, dates, account numbers or reasons. Never mention internal limits, budgets, tolerances or thresholds (you don't know them).
Never promise a payment; the rules decide that. Be warm and brief. Sign as "ORBIT, agente de pagos de <company>" in one short line.`;

const VENDOR_SYSTEM = `You role-play the billing contact (or billing agent) of a vendor answering the paying company's agent.
The decision of what to answer was already made and is given as facts (the kind of reply and the corrected figures). Write the words only: brief, natural, in character.
Use ONLY the facts given; never change amounts or add new conditions. If a verbatim text is provided, include it exactly as written.`;

export function claudeProse(client = new Anthropic()): ProseWriter {
  async function write(system: string, prompt: string, fallback: string): Promise<{ text: string; source: "claude" | "template" }> {
    try {
      const response = await client.beta.messages.parse(
        {
          model: PROSE_MODEL,
          max_tokens: 600,
          system,
          messages: [{ role: "user", content: prompt }],
          output_config: { effort: "low", format: zodOutputFormat(Message) },
        },
        { signal: AbortSignal.timeout(8000) },
      );
      const text = response.parsed_output?.message?.trim();
      return text ? { text, source: "claude" } : { text: fallback, source: "template" };
    } catch (err) {
      console.error("[prose] falling back to template:", (err as Error).message);
      return { text: fallback, source: "template" };
    }
  }

  return {
    orbit(request: OrbitRequest) {
      const { facts } = request;
      const prompt = [
        `Language: ${LANG[facts.language]}.`,
        `Request type: ${request.type}.`,
        `Facts (JSON): ${JSON.stringify(facts)}`,
        `A template version you may paraphrase: ${orbitTemplate(request)}`,
      ].join("\n");
      return write(CLARA_SYSTEM, prompt, orbitTemplate(request));
    },
    vendor(reply: VendorReply, request: OrbitRequest) {
      const { facts } = request;
      const prompt = [
        `Language: ${LANG[facts.language]}.`,
        `You are ${facts.vendorName}. The paying company is ${facts.companyName}. They asked: ${request.type}.`,
        `Your reply kind: ${reply.kind}.`,
        reply.invoice ? `Corrected invoice figures: ${JSON.stringify(reply.invoice)}` : "",
        reply.note ? `Fact to convey: ${reply.note}` : "",
        reply.text ? `Verbatim text to include exactly: ${reply.text}` : "",
        `A template version you may paraphrase: ${vendorTemplate(reply, request)}`,
      ]
        .filter(Boolean)
        .join("\n");
      return write(VENDOR_SYSTEM, prompt, vendorTemplate(reply, request));
    },
  };
}

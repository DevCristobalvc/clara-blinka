import type { AgentActivation, AgentKind, Company } from "@/lib/engine/types";
import { HttpError, getCompanyOrThrow } from "./cases";
import type { CaseStore } from "./store";

/**
 * Agents the company hires. Activation is a payment to ORBIT: USDC over x402 on Base Sepolia for
 * the demo, Blinka's USD rails or an x402 call from the company's own agent in production.
 */

export const X402_NETWORK = "eip155:84532"; // Base Sepolia
export const X402_FACILITATOR = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
/** ORBIT's treasury on Base Sepolia. Set ORBIT_PAY_TO; the fallback is a placeholder that only works for a demo. */
export const PAY_TO = (process.env.ORBIT_PAY_TO ?? process.env.ORBIT_PAYTO ?? process.env.ORBIT_PAY ?? process.env.X402_PAY_TO ?? process.env.PAY_TO ?? "0x000000000000000000000000000000000000dEaD") as `0x${string}`;
export const ACTIVATION_FREE = process.env.ORBIT_ACTIVATION_FREE === "1";
export const REQUIRE_ACTIVATION = process.env.ORBIT_REQUIRE_ACTIVATION === "1";

export interface AgentPlan {
  kind: AgentKind;
  name: string;
  tagline: string;
  /** x402 price string ("$0.10" = 100000 USDC units). */
  price: string;
  billing: string;
  available: boolean;
}

export const AGENT_PLANS: Record<AgentKind, AgentPlan> = {
  pagador: {
    kind: "pagador",
    name: "Pagador",
    tagline: "Revisa lo que debes, decide, negocia con el proveedor y registra el pago.",
    price: "$0.10",
    billing: "Activación de demo. En producción: por caso resuelto, cobrado por x402 o por los rieles de Blinka.",
    available: true,
  },
  cobrador: {
    kind: "cobrador",
    name: "Cobrador",
    tagline: "Envía lo que te deben, persigue el pago y negocia con tu cliente, con tus reglas invertidas.",
    price: "$0.10",
    billing: "Activación de demo. El cobrador entra en la siguiente versión; la activación queda registrada.",
    available: true,
  },
};

export function isAgentKind(v: string): v is AgentKind {
  return v === "pagador" || v === "cobrador";
}

export function agentActive(company: Company | undefined, kind: AgentKind): boolean {
  return Boolean(company?.agents?.[kind]?.active);
}

/** Record a paid (or demo) activation on the company. */
export async function activateAgent(store: CaseStore, companyId: string, kind: AgentKind, payment: AgentActivation["payment"]): Promise<Company> {
  if (!isAgentKind(kind)) throw new HttpError(404, "Unknown agent");
  const company = await getCompanyOrThrow(store, companyId);
  const activation: AgentActivation = { active: true, activatedAt: new Date().toISOString(), payment };
  const next: Company = { ...company, agents: { ...company.agents, [kind]: activation } };
  await store.putCompany(next);
  return next;
}

/** Best-effort read of the payer from an x402 v2 PAYMENT-SIGNATURE header (exact EVM scheme). */
export function payerFromPaymentHeader(header: string | null): { payer?: string; network?: string } {
  if (!header) return {};
  try {
    const decoded = JSON.parse(Buffer.from(header, "base64").toString("utf8")) as { network?: string; payload?: { authorization?: { from?: string } } };
    return { payer: decoded.payload?.authorization?.from, network: decoded.network };
  } catch {
    return {};
  }
}

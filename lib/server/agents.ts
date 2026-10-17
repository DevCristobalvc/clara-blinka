import { createHmac } from "node:crypto";
import { createPublicClient, erc20Abi, formatUnits, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { AgentActivation, AgentFunding, AgentKind, Company } from "@/lib/engine/types";
import { HttpError, getCompanyOrThrow } from "./cases";
import type { CaseStore } from "./store";

/**
 * Agents the company hires. Two payments, both in USDC over x402 on Base Sepolia for the demo:
 *  - activation: the company pays ORBIT's treasury (fixed address) to switch the agent on;
 *  - funding: the company loads USDC into the agent's own wallet (one per company), which the agent pays from.
 * In production the same two bills ride Blinka's USD rails or an x402 call from the company's own agent.
 */

export const X402_NETWORK = "eip155:84532"; // Base Sepolia
export const X402_FACILITATOR = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";
/** ORBIT's treasury on Base Sepolia. Set ORBIT_PAY_TO; the fallback is a placeholder that only works for a demo. */
export const PAY_TO = (process.env.ORBIT_PAY_TO ?? process.env.ORBIT_PAYTO ?? process.env.ORBIT_PAY ?? process.env.X402_PAY_TO ?? process.env.PAY_TO ?? "0x000000000000000000000000000000000000dEaD") as Address;
export const ACTIVATION_FREE = process.env.ORBIT_ACTIVATION_FREE === "1";
export const REQUIRE_ACTIVATION = process.env.ORBIT_REQUIRE_ACTIVATION === "1";
/** Circle's USDC on Base Sepolia. */
export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export interface AgentPlan {
  kind: AgentKind;
  name: string;
  tagline: string;
  /** x402 price strings ("$0.10" = 100000 USDC units). */
  activationPrice: string;
  fundingPrice: string;
  billing: string;
  available: boolean;
}

export const AGENT_PLANS: Record<AgentKind, AgentPlan> = {
  pagador: {
    kind: "pagador",
    name: "Pagador",
    tagline: "Revisa lo que debes, decide, negocia con el proveedor y registra el pago.",
    activationPrice: "$0.10",
    fundingPrice: "$1.00",
    billing: "Activación de demo. En producción: por caso resuelto, cobrado por x402 o por los rieles de Blinka.",
    available: true,
  },
  cobrador: {
    kind: "cobrador",
    name: "Cobrador",
    tagline: "Envía lo que te deben, persigue el pago y negocia con tu cliente, con tus reglas invertidas.",
    activationPrice: "$0.10",
    fundingPrice: "$1.00",
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

/**
 * The agent's wallet for a company: derived from a server secret, so nothing is stored and the same
 * company always gets the same address. The key exists only to derive the address; the demo never sends from it.
 */
export function agentWallet(companyId: string, kind: AgentKind): Address {
  const seed = process.env.ORBIT_WALLET_SEED ?? process.env.CLARA_SIGNING_KEY ?? "orbit-demo-seed";
  const pk = `0x${createHmac("sha256", seed).update(`${companyId}:${kind}`).digest("hex")}` as `0x${string}`;
  return privateKeyToAccount(pk).address;
}

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.BASE_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) });

export async function usdcBalance(address: Address): Promise<string | undefined> {
  try {
    const raw = await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "balanceOf", args: [address] });
    return formatUnits(raw, 6);
  } catch {
    return undefined;
  }
}

/** Record a paid (or demo) activation on the company. */
export async function activateAgent(store: CaseStore, companyId: string, kind: AgentKind, payment: AgentActivation["payment"]): Promise<Company> {
  if (!isAgentKind(kind)) throw new HttpError(404, "Unknown agent");
  const company = await getCompanyOrThrow(store, companyId);
  const previous = company.agents?.[kind];
  const activation: AgentActivation = { active: true, activatedAt: new Date().toISOString(), wallet: agentWallet(companyId, kind), funding: previous?.funding ?? [], payment };
  const next: Company = { ...company, agents: { ...company.agents, [kind]: activation } };
  await store.putCompany(next);
  return next;
}

/** Record funds loaded into the agent's wallet. Funding before activation is allowed; the agent still needs activating to work. */
export async function fundAgent(store: CaseStore, companyId: string, kind: AgentKind, funding: AgentFunding): Promise<Company> {
  if (!isAgentKind(kind)) throw new HttpError(404, "Unknown agent");
  const company = await getCompanyOrThrow(store, companyId);
  const previous = company.agents?.[kind];
  const activation: AgentActivation = {
    active: previous?.active ?? false,
    activatedAt: previous?.activatedAt ?? "",
    payment: previous?.payment ?? { method: "demo" },
    wallet: agentWallet(companyId, kind),
    funding: [...(previous?.funding ?? []), funding],
  };
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

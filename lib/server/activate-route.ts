import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import { NextResponse, type NextRequest } from "next/server";
import type { AgentKind } from "@/lib/engine/types";
import { ACTIVATION_FREE, AGENT_PLANS, PAY_TO, X402_FACILITATOR, X402_NETWORK, activateAgent, agentWallet, fundAgent, payerFromPaymentHeader } from "./agents";
import { COMPANY_ID, companyForRequest } from "./http";
import { getStore } from "./store";

declare global {
  var __orbitX402: x402ResourceServer | undefined;
}

/** One resource server per process: the public facilitator verifies and settles USDC on Base Sepolia. */
function resourceServer(): x402ResourceServer {
  if (!globalThis.__orbitX402) {
    globalThis.__orbitX402 = new x402ResourceServer(new HTTPFacilitatorClient({ url: X402_FACILITATOR })).register(X402_NETWORK, new ExactEvmScheme());
  }
  return globalThis.__orbitX402;
}

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Paid agent routes. The client gets a 402 with the price, pays USDC, retries with the payment, and only then
 * does the handler run; settlement happens after a successful response.
 *  - activate: price goes to ORBIT's treasury (PAY_TO); switches the agent on.
 *  - fund: price goes to the agent's own wallet for this company; recorded as loaded funds.
 * With ORBIT_ACTIVATION_FREE=1 both run without payment (previews, no wallet).
 */
export function paidAgentRoute(kind: AgentKind, action: "activate" | "fund") {
  const plan = AGENT_PLANS[kind];
  const price = action === "activate" ? plan.activationPrice : plan.fundingPrice;
  const payTo = action === "activate" ? PAY_TO : agentWallet(COMPANY_ID, kind);

  const handler = async (request: NextRequest) => {
    await companyForRequest();
    const { payer, network } = payerFromPaymentHeader(request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT"));
    const paid = !(ACTIVATION_FREE && !payer);
    const company =
      action === "activate"
        ? await activateAgent(getStore(), COMPANY_ID, kind, paid ? { method: "x402", network: network ?? X402_NETWORK, asset: "USDC", amount: price, payer } : { method: "demo" })
        : await fundAgent(getStore(), COMPANY_ID, kind, { amount: paid ? price : "$0.00", asset: "USDC", network: network ?? X402_NETWORK, at: new Date().toISOString(), payer });
    return NextResponse.json({ ok: true, agent: kind, action, activation: company.agents?.[kind] }, { headers: NO_STORE });
  };
  if (ACTIVATION_FREE) return handler;
  return withX402(
    handler,
    {
      accepts: [{ scheme: "exact", price, network: X402_NETWORK, payTo }],
      description: action === "activate" ? `ORBIT: activar el agente ${plan.name}` : `ORBIT: cargar fondos al agente ${plan.name}`,
      mimeType: "application/json",
    },
    resourceServer(),
  );
}

/** @deprecated use paidAgentRoute(kind, "activate") */
export const activateRoute = (kind: AgentKind) => paidAgentRoute(kind, "activate");

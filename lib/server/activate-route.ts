import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { withX402 } from "@x402/next";
import { NextResponse, type NextRequest } from "next/server";
import type { AgentKind } from "@/lib/engine/types";
import { ACTIVATION_FREE, AGENT_PLANS, PAY_TO, X402_FACILITATOR, X402_NETWORK, activateAgent, payerFromPaymentHeader } from "./agents";
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

/**
 * POST /api/agents/<kind>/activate. The client gets a 402 with the price, pays USDC, retries with the
 * payment, and only then does the handler run; settlement happens after a successful response.
 * With ORBIT_ACTIVATION_FREE=1 the route activates without payment (previews, no wallet).
 */
export function activateRoute(kind: AgentKind) {
  const plan = AGENT_PLANS[kind];
  const handler = async (request: NextRequest) => {
    await companyForRequest();
    const { payer, network } = payerFromPaymentHeader(request.headers.get("PAYMENT-SIGNATURE") ?? request.headers.get("X-PAYMENT"));
    const company = await activateAgent(
      getStore(),
      COMPANY_ID,
      kind,
      ACTIVATION_FREE && !payer
        ? { method: "demo" }
        : { method: "x402", network: network ?? X402_NETWORK, asset: "USDC", amount: plan.price, payer },
    );
    return NextResponse.json({ ok: true, agent: kind, activation: company.agents?.[kind] }, { headers: { "Cache-Control": "no-store" } });
  };
  if (ACTIVATION_FREE) return handler;
  return withX402(
    handler,
    {
      accepts: [{ scheme: "exact", price: plan.price, network: X402_NETWORK, payTo: PAY_TO }],
      description: `ORBIT: activar el agente ${plan.name}`,
      mimeType: "application/json",
    },
    resourceServer(),
  );
}

import { connection } from "next/server";
import { ACTIVATION_FREE, AGENT_PLANS, PAY_TO, REQUIRE_ACTIVATION, X402_FACILITATOR, X402_NETWORK } from "@/lib/server/agents";
import { companyForRequest, handle, json } from "@/lib/server/http";

/** The agents on offer, their price, and what this company has activated. */
export async function GET() {
  await connection();
  return handle(async () => {
    const company = await companyForRequest();
    return json({
      plans: Object.values(AGENT_PLANS),
      activations: company.agents ?? {},
      payment: { network: X402_NETWORK, payTo: PAY_TO, facilitator: X402_FACILITATOR, asset: "USDC", free: ACTIVATION_FREE, required: REQUIRE_ACTIVATION },
    });
  });
}

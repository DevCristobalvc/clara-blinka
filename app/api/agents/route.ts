import { connection } from "next/server";
import { ACTIVATION_FREE, AGENT_PLANS, PAY_TO, REQUIRE_ACTIVATION, X402_FACILITATOR, X402_NETWORK, agentWallet, usdcBalance } from "@/lib/server/agents";
import { COMPANY_ID, companyForRequest, handle, json } from "@/lib/server/http";

/** The agents on offer, their prices, what this company has activated, and each agent's wallet with its USDC balance. */
export async function GET() {
  await connection();
  return handle(async () => {
    const company = await companyForRequest();
    const wallets = Object.fromEntries(
      await Promise.all(
        (Object.keys(AGENT_PLANS) as (keyof typeof AGENT_PLANS)[]).map(async (kind) => {
          const address = agentWallet(COMPANY_ID, kind);
          return [kind, { address, balance: await usdcBalance(address) }] as const;
        }),
      ),
    );
    return json({
      plans: Object.values(AGENT_PLANS),
      activations: company.agents ?? {},
      wallets,
      payment: { network: X402_NETWORK, payTo: PAY_TO, facilitator: X402_FACILITATOR, asset: "USDC", free: ACTIVATION_FREE, required: REQUIRE_ACTIVATION },
      // Names only, never values: lets the UI (and us) see which switches this deployment has.
      env: Object.keys(process.env).filter((k) => /ORBIT|PAY|PRIVY|X402|SUPABASE|TYPESAFE|ANTHROPIC|SIGNING/i.test(k)).sort(),
    });
  });
}

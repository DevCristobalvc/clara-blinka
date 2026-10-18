// Pays ORBIT's x402 agent routes with a plain test wallet, to prove the server + facilitator path without a browser.
// usage: node --env-file=.env.local scripts/x402-pay.mjs [activate|fund] [pagador|cobrador]
// needs: ORBIT_TEST_PAYER_PRIVATE_KEY (a Base Sepolia wallet holding test USDC from https://faucet.circle.com)
import { ExactEvmScheme } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { privateKeyToAccount } from "viem/accounts";

const [action = "activate", kind = "pagador"] = process.argv.slice(2);
const base = process.env.ORBIT_URL ?? "http://localhost:3000";
const pk = process.env.ORBIT_TEST_PAYER_PRIVATE_KEY;
if (!pk) {
  console.error("Set ORBIT_TEST_PAYER_PRIVATE_KEY in .env.local");
  process.exit(1);
}
const account = privateKeyToAccount(pk);
console.log(`payer ${account.address} → POST ${base}/api/agents/${kind}/${action}`);

const paidFetch = wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: "eip155:84532", client: new ExactEvmScheme(account) }], spendControls: { maxAmountPerPayment: "$25" } });
const started = Date.now();
const res = await paidFetch(`${base}/api/agents/${kind}/${action}`, { method: "POST" });
const body = await res.json().catch(() => ({}));
console.log(`HTTP ${res.status} in ${Date.now() - started} ms`, JSON.stringify(body).slice(0, 300));
const header = res.headers.get("PAYMENT-RESPONSE");
if (header) {
  const settled = decodePaymentResponseHeader(header);
  console.log("PAYMENT-RESPONSE", JSON.stringify(settled));
  if (settled?.transaction) {
    await fetch(`${base}/api/agents/${kind}/tx`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, transaction: settled.transaction, payer: settled.payer }) });
    console.log("tx attached to the activation record");
  }
}
process.exit(res.ok ? 0 : 1);

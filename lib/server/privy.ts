import { PrivyClient } from "@privy-io/node";
import type { Address } from "viem";

/**
 * Privy server wallets (Node SDK). ORBIT keeps one Privy wallet per company as the agent's *relayer*: it
 * submits the agent's signed USDC authorizations with Privy gas sponsorship (enabled in the Privy dashboard),
 * so the agent's funds wallet never needs ETH. The relayer holds no funds.
 *
 * Env: NEXT_PUBLIC_PRIVY_APP_ID (or PRIVY_APP_ID) and PRIVY_APP_SECRET (or PRIVY_SECRET).
 */

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? process.env.PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET ?? process.env.PRIVY_SECRET;

export const PRIVY_SPONSORED = Boolean(APP_ID && APP_SECRET);

declare global {
  var __orbitPrivy: PrivyClient | undefined;
  var __orbitRelayers: Map<string, RelayerWallet> | undefined;
}

export interface RelayerWallet {
  id: string;
  address: Address;
}

export function privyClient(): PrivyClient {
  if (!APP_ID || !APP_SECRET) throw new Error("Privy is not configured (NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_SECRET)");
  if (!globalThis.__orbitPrivy) globalThis.__orbitPrivy = new PrivyClient({ appId: APP_ID, appSecret: APP_SECRET });
  return globalThis.__orbitPrivy;
}

const externalId = (companyId: string) => `orbit-relayer-${companyId.replace(/[^A-Za-z0-9_-]/g, "-")}`;

/** The company's relayer wallet, created on first use (idempotent: same company, same wallet). */
export async function relayerWallet(companyId: string): Promise<RelayerWallet> {
  const cache = (globalThis.__orbitRelayers ??= new Map());
  const cached = cache.get(companyId);
  if (cached) return cached;
  const privy = privyClient();
  const ext = externalId(companyId);
  let found: RelayerWallet | undefined;
  for await (const w of privy.wallets().list({ chain_type: "ethereum", external_id: ext })) {
    found = { id: w.id, address: w.address as Address };
    break;
  }
  if (!found) {
    const w = await privy.wallets().create({ chain_type: "ethereum", external_id: ext, display_name: `ORBIT relayer ${companyId}`, idempotency_key: ext });
    found = { id: w.id, address: w.address as Address };
    console.log(`[privy] created relayer wallet ${w.address} for ${companyId}`);
  }
  cache.set(companyId, found);
  return found;
}

/** Submit a contract call from the relayer with Privy gas sponsorship. Returns the tx hash (or the Privy transaction id while a sponsored op is still being mined). */
export async function sponsoredCall(companyId: string, caip2: `eip155:${number}`, to: Address, data: `0x${string}`): Promise<{ hash?: `0x${string}`; transactionId?: string }> {
  const privy = privyClient();
  const relayer = await relayerWallet(companyId);
  const res = await privy.wallets().ethereum().sendTransaction(relayer.id, { caip2, params: { transaction: { to, data } }, sponsor: true });
  const hash = res.hash && res.hash !== "0x" ? (res.hash as `0x${string}`) : undefined;
  return { hash, transactionId: res.transaction_id };
}

/** Resolve the on-chain hash of a sponsored Privy transaction once it is broadcast. */
export async function sponsoredHash(transactionId: string, attempts = 20, everyMs = 1500): Promise<`0x${string}` | undefined> {
  const privy = privyClient();
  for (let i = 0; i < attempts; i++) {
    const tx = await privy.transactions().get(transactionId);
    if (tx.transaction_hash) return tx.transaction_hash as `0x${string}`;
    if (tx.status === "execution_reverted" || tx.status === "provider_error" || tx.status === "replaced") return undefined;
    await new Promise((r) => setTimeout(r, everyMs));
  }
  return undefined;
}

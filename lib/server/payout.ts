import { createPublicClient, createWalletClient, encodeFunctionData, erc20Abi, formatUnits, http, parseAbi, parseSignature, parseUnits, type Address, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { randomBytes } from "node:crypto";
import { toUSD } from "@/lib/engine/fx";
import type { Company, PaymentExecutor, PaymentRecord, Settlement } from "@/lib/engine/types";
import { USDC_BASE_SEPOLIA, agentAccount } from "./agents";
import { PRIVY_SPONSORED, sponsoredCall, sponsoredHash } from "./privy";

/**
 * On-chain executor: the pagador pays each approved invoice from its own wallet, in testnet USDC on Base
 * Sepolia, to the vendor's payout wallet. Demo scale: 1 USDC = ORBIT_PAYOUT_SCALE USD of invoice (default 1,000),
 * so the whole demo set costs about 11 USDC.
 *
 * Gas: the agent's wallet holds only USDC. It signs an EIP-3009 `transferWithAuthorization` (off-chain, free)
 * and the company's Privy relayer wallet submits it with Privy gas sponsorship, so no wallet needs ETH.
 * Without Privy the executor falls back to a direct `transfer` (which then needs ETH in the agent wallet).
 *
 * The decision is already recorded when this runs; a chain hiccup leaves the settlement "pending" with the
 * reason, it never blocks or reverses a decision.
 */

export const PAYOUT_SCALE = Number(process.env.ORBIT_PAYOUT_SCALE ?? 1000);
export const PAYOUTS_ONCHAIN = process.env.ORBIT_PAYOUTS === "onchain";
const CAIP2 = "eip155:84532" as const;

/** USDC units (6 decimals) for an invoice amount in USD at the demo scale; never below 0.01 USDC. */
export function usdcFor(amountUSD: number, scale = PAYOUT_SCALE): bigint {
  const usdc = Math.max(0.01, Math.round((amountUSD / scale) * 100) / 100);
  return parseUnits(usdc.toFixed(2), 6);
}

const rpc = () => http(process.env.BASE_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL);

const eip3009Abi = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function name() view returns (string)",
  "function version() view returns (string)",
]);

const AUTH_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

let usdcDomain: { name: string; version: string } | undefined;

export class WalletExecutor implements PaymentExecutor {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async execute(record: PaymentRecord, caseId: string, company?: Company): Promise<Settlement> {
    const at = this.now();
    const amountUSD = toUSD(record.amount, record.currency);
    const units = usdcFor(amountUSD);
    const amountUSDC = formatUnits(units, 6);
    const vendor = company?.beneficiaries.find((b) => b.id === record.beneficiaryId);
    const to = vendor?.payoutWallet as Address | undefined;
    const base: Settlement = { ref: `pago-${caseId.slice(0, 8)}`, rail: "base-sepolia-usdc", at, note: "", amountUSDC, to, network: CAIP2 };
    if (!company || !vendor || !to) {
      return { ...base, status: "pending", note: "Decisión registrada. El proveedor no tiene wallet de pago registrada; el pago queda pendiente de ejecución." };
    }
    const companyId = company.id ?? "andes";
    try {
      const account = agentAccount(companyId, "pagador");
      const publicClient = createPublicClient({ chain: baseSepolia, transport: rpc() });
      const balance = await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
      if (balance < units) {
        return { ...base, status: "pending", note: `Decisión registrada. La wallet del agente tiene ${formatUnits(balance, 6)} USDC y el pago requiere ${amountUSDC}; carga fondos para ejecutarlo.` };
      }

      let hash: Hex | undefined;
      let via = "directo";
      if (PRIVY_SPONSORED) {
        via = "Privy (gas patrocinado)";
        usdcDomain ??= {
          name: await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: eip3009Abi, functionName: "name" }),
          version: await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: eip3009Abi, functionName: "version" }),
        };
        const nonce = `0x${randomBytes(32).toString("hex")}` as Hex;
        const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const signature = await account.signTypedData({
          domain: { ...usdcDomain, chainId: baseSepolia.id, verifyingContract: USDC_BASE_SEPOLIA },
          types: AUTH_TYPES,
          primaryType: "TransferWithAuthorization",
          message: { from: account.address, to, value: units, validAfter: BigInt(0), validBefore, nonce },
        });
        const { v, r, s } = parseSignature(signature);
        const data = encodeFunctionData({ abi: eip3009Abi, functionName: "transferWithAuthorization", args: [account.address, to, units, BigInt(0), validBefore, nonce, Number(v ?? BigInt(27)), r, s] });
        const sent = await sponsoredCall(companyId, CAIP2, USDC_BASE_SEPOLIA, data);
        hash = sent.hash ?? (sent.transactionId ? await sponsoredHash(sent.transactionId) : undefined);
        if (!hash) return { ...base, status: "pending", note: `Decisión registrada. El pago salió por ${via} pero la red aún no confirma la transacción (Privy tx ${sent.transactionId ?? "?"}); queda pendiente de ejecución.` };
      } else {
        const walletClient = createWalletClient({ account, chain: baseSepolia, transport: rpc() });
        hash = await walletClient.writeContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "transfer", args: [to, units] });
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 90_000 });
      if (receipt.status !== "success") return { ...base, status: "failed", transaction: hash, note: "La transacción fue rechazada por la red; el pago queda pendiente de ejecución." };
      return {
        ...base,
        ref: `pago-${hash.slice(2, 10)}`,
        status: "sent",
        transaction: hash,
        note: `Pagado desde la wallet del agente (${via}): ${amountUSDC} USDC a la cuenta Blinka de ${vendor.name}; Blinka lo liquida en ${vendor.currency} en su banco (${vendor.account.value}). Escala demo: 1 USDC = ${PAYOUT_SCALE.toLocaleString("es-CO")} USD.`,
      };
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const privyMsg = /^\d{3} \{/.test(msg) ? (() => { try { return JSON.parse(msg.slice(4)).error as string; } catch { return undefined; } })() : undefined;
      const reason = privyMsg
        ? `Privy: ${String(privyMsg).slice(0, 160)}`
        : /insufficient funds/i.test(msg) ? "la wallet no tiene ETH para el gas en Base Sepolia" : msg.split("\n")[0].slice(0, 160);
      console.error("[payout] failed:", msg.slice(0, 400));
      return { ...base, status: "pending", note: `Decisión registrada. El pago on-chain no se ejecutó (${reason}); queda pendiente de ejecución.` };
    }
  }
}

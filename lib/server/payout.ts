import { createPublicClient, createWalletClient, erc20Abi, formatUnits, http, parseUnits, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { toUSD } from "@/lib/engine/fx";
import type { Company, PaymentExecutor, PaymentRecord, Settlement } from "@/lib/engine/types";
import { USDC_BASE_SEPOLIA, agentAccount } from "./agents";

/**
 * On-chain executor: the pagador pays each approved invoice from its own wallet, in testnet USDC on Base
 * Sepolia, to the vendor's payout wallet. Demo scale: 1 USDC = ORBIT_PAYOUT_SCALE USD of invoice (default 1,000),
 * so the whole demo set costs about 11 USDC. The decision is already recorded when this runs; a chain
 * hiccup leaves the settlement "pending" with the reason, it never blocks or reverses a decision.
 */

export const PAYOUT_SCALE = Number(process.env.ORBIT_PAYOUT_SCALE ?? 1000);
export const PAYOUTS_ONCHAIN = process.env.ORBIT_PAYOUTS === "onchain";

/** USDC units (6 decimals) for an invoice amount in USD at the demo scale; never below 0.01 USDC. */
export function usdcFor(amountUSD: number, scale = PAYOUT_SCALE): bigint {
  const usdc = Math.max(0.01, Math.round((amountUSD / scale) * 100) / 100);
  return parseUnits(usdc.toFixed(2), 6);
}

const rpc = () => http(process.env.BASE_SEPOLIA_RPC_URL ?? process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL);

export class WalletExecutor implements PaymentExecutor {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async execute(record: PaymentRecord, caseId: string, company?: Company): Promise<Settlement> {
    const at = this.now();
    const amountUSD = toUSD(record.amount, record.currency);
    const units = usdcFor(amountUSD);
    const amountUSDC = formatUnits(units, 6);
    const vendor = company?.beneficiaries.find((b) => b.id === record.beneficiaryId);
    const to = vendor?.payoutWallet as Address | undefined;
    const base: Settlement = { ref: `pago-${caseId.slice(0, 8)}`, rail: "base-sepolia-usdc", at, note: "", amountUSDC, to, network: "eip155:84532" };
    if (!company || !vendor || !to) {
      return { ...base, status: "pending", note: "Decisión registrada. El proveedor no tiene wallet de pago registrada; el pago queda pendiente de ejecución." };
    }
    try {
      const account = agentAccount(company.id ?? "andes", "pagador");
      const publicClient = createPublicClient({ chain: baseSepolia, transport: rpc() });
      const walletClient = createWalletClient({ account, chain: baseSepolia, transport: rpc() });
      const balance = await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
      if (balance < units) {
        return { ...base, status: "pending", note: `Decisión registrada. La wallet del agente tiene ${formatUnits(balance, 6)} USDC y el pago requiere ${amountUSDC}; carga fondos para ejecutarlo.` };
      }
      const hash = await walletClient.writeContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "transfer", args: [to, units] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") return { ...base, status: "failed", transaction: hash, note: "La transacción fue rechazada por la red; el pago queda pendiente de ejecución." };
      return { ...base, ref: `pago-${hash.slice(2, 10)}`, status: "sent", transaction: hash, note: `Pagado desde la wallet del agente: ${amountUSDC} USDC a la cuenta Blinka de ${vendor.name}; Blinka lo liquida en ${vendor.currency} en su banco (${vendor.account.value}). Escala demo: 1 USDC = ${PAYOUT_SCALE.toLocaleString("es-CO")} USD.` };
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const reason = /insufficient funds|gas/i.test(msg) ? "la wallet del agente no tiene ETH para el gas en Base Sepolia" : msg.split("\n")[0].slice(0, 160);
      console.error("[payout] failed:", msg.slice(0, 300));
      return { ...base, status: "pending", note: `Decisión registrada. El pago on-chain no se ejecutó (${reason}); queda pendiente de ejecución.` };
    }
  }
}

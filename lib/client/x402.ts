"use client";

import type { ConnectedWallet } from "@privy-io/react-auth";
import { ExactEvmScheme, toClientEvmSigner } from "@x402/evm";
import { decodePaymentResponseHeader, wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { createPublicClient, createWalletClient, custom, erc20Abi, formatUnits, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";

export const BASE_SEPOLIA_CAIP2 = "eip155:84532";
/** Circle's USDC on Base Sepolia (faucet: https://faucet.circle.com). */
export const USDC_BASE_SEPOLIA: Address = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL) });

export async function usdcBalance(address: Address): Promise<string> {
  const raw = await publicClient.readContract({ address: USDC_BASE_SEPOLIA, abi: erc20Abi, functionName: "balanceOf", args: [address] });
  return formatUnits(raw, 6);
}

/** A fetch that pays 402s with the Privy wallet: the embedded wallet only signs an EIP-3009 authorization; the facilitator pays gas. */
export async function paidFetchFor(wallet: ConnectedWallet) {
  await wallet.switchChain(baseSepolia.id);
  const provider = await wallet.getEthereumProvider();
  const address = wallet.address as Address;
  const walletClient = createWalletClient({ account: address, chain: baseSepolia, transport: custom(provider) });
  const signer = toClientEvmSigner(
    {
      address,
      signTypedData: (m) => walletClient.signTypedData({ account: address, ...m } as unknown as Parameters<typeof walletClient.signTypedData>[0]),
    },
    publicClient,
  );
  return wrapFetchWithPaymentFromConfig(fetch, { schemes: [{ network: BASE_SEPOLIA_CAIP2, client: new ExactEvmScheme(signer) }], spendControls: { maxAmountPerPayment: "$25" } });
}

export function paymentDetails(res: Response): { transaction?: string; network?: string; payer?: string } {
  const header = res.headers.get("PAYMENT-RESPONSE");
  if (!header) return {};
  try {
    const d = decodePaymentResponseHeader(header) as { transaction?: string; network?: string; payer?: string };
    return { transaction: d.transaction, network: d.network, payer: d.payer };
  } catch {
    return {};
  }
}

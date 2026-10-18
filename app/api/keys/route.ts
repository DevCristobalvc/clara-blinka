import { connection } from "next/server";
import { publicKeyPem, signingKeys, verifyReceipt } from "@/lib/engine/receipt";
import type { Receipt } from "@/lib/engine/types";
import { handle, json } from "@/lib/server/http";

/** The public key that verifies ORBIT's decision receipts. */
export async function GET() {
  await connection(); // request time: the key is read from the environment of the running server
  return handle(async () => json({ alg: "ed25519", publicKey: publicKeyPem(), ephemeral: signingKeys().ephemeral }));
}

/** Verify a signed decision receipt against its Ed25519 signature and canonical payload. */
export async function POST(req: Request) {
  await connection();
  return handle(async () => {
    const body = (await req.json().catch(() => ({}))) as { receipt?: Receipt };
    const receipt = body.receipt;
    if (!receipt?.payload || !receipt?.signature || !receipt?.publicKey) {
      return json({ valid: false, error: "Invalid receipt format" }, { status: 400 });
    }
    const valid = verifyReceipt(receipt);
    return json({
      valid,
      matchesServerKey: receipt.publicKey.trim() === publicKeyPem().trim(),
      policyHash: receipt.payload.policyHash,
      alg: receipt.alg,
    });
  });
}

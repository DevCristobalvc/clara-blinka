import { connection } from "next/server";
import { publicKeyPem, signingKeys } from "@/lib/engine/receipt";
import { handle, json } from "@/lib/server/http";

/** The public key that verifies ORBIT's decision receipts. */
export async function GET() {
  await connection(); // request time: the key is read from the environment of the running server
  return handle(async () => json({ alg: "ed25519", publicKey: publicKeyPem(), ephemeral: signingKeys().ephemeral }));
}

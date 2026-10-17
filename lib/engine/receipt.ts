import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";
import type { Company, Decision, Receipt, ReceiptPayload } from "./types";

/**
 * Signed decision receipts. The rules are pure, so anyone holding the inputs can replay decide() and
 * get the same answer; the receipt proves which inputs, which rule set (policyHash) and which outcome
 * ORBIT recorded, and that nobody edited the record afterwards.
 */

export const ENGINE_VERSION = "orbit@0.3";

export function canonicalJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJSON(obj[k])}`).join(",")}}`;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hash of everything that can change a decision: limits, beneficiaries and contracts. */
export function policyHash(company: Company): string {
  return sha256(canonicalJSON({ policy: company.policy, beneficiaries: company.beneficiaries, contracts: company.contracts }));
}

export interface SigningKeys {
  privateKey: KeyObject;
  publicKey: KeyObject;
  ephemeral: boolean;
}

export function keysFromPem(pem: string): SigningKeys {
  const text = pem.includes("BEGIN") ? pem : Buffer.from(pem, "base64").toString("utf8");
  const privateKey = createPrivateKey(text);
  return { privateKey, publicKey: createPublicKey(privateKey), ephemeral: false };
}

export function generateKeys(): SigningKeys {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return { privateKey, publicKey, ephemeral: true };
}

/** PKCS8 PEM, base64-wrapped, ready for ORBIT_SIGNING_KEY. */
export function exportPrivateKey(keys: SigningKeys): string {
  return Buffer.from(keys.privateKey.export({ type: "pkcs8", format: "pem" }) as string).toString("base64");
}

let processKeys: SigningKeys | undefined;

/** The server's keys: ORBIT_SIGNING_KEY when set, otherwise one pair per process (receipts say so). */
export function signingKeys(): SigningKeys {
  if (!processKeys) {
    const env = process.env.ORBIT_SIGNING_KEY ?? process.env.CLARA_SIGNING_KEY; // old name still accepted
    processKeys = env ? keysFromPem(env) : generateKeys();
    if (processKeys.ephemeral) console.warn("[receipt] ORBIT_SIGNING_KEY not set: receipts are signed with an ephemeral key");
  }
  return processKeys;
}

export function publicKeyPem(keys: SigningKeys = signingKeys()): string {
  return keys.publicKey.export({ type: "spki", format: "pem" }) as string;
}

export function signReceipt(payload: Omit<ReceiptPayload, "engine" | "ephemeral">, keys: SigningKeys = signingKeys()): Receipt {
  const full: ReceiptPayload = { ...payload, engine: ENGINE_VERSION, ...(keys.ephemeral ? { ephemeral: true } : {}) };
  const signature = sign(null, Buffer.from(canonicalJSON(full)), keys.privateKey).toString("base64");
  return { payload: full, signature, publicKey: publicKeyPem(keys), alg: "ed25519" };
}

export function verifyReceipt(receipt: Receipt): boolean {
  try {
    return verify(null, Buffer.from(canonicalJSON(receipt.payload)), createPublicKey(receipt.publicKey), Buffer.from(receipt.signature, "base64"));
  } catch {
    return false;
  }
}

export function receiptFor(caseId: string, decision: Decision, company: Company, keys?: SigningKeys): Receipt {
  return signReceipt(
    {
      caseId,
      decisionId: decision.id,
      action: decision.action,
      reasons: decision.reasons,
      invoiceNumber: decision.invoice.invoiceNumber,
      beneficiaryId: decision.beneficiaryId,
      amount: decision.invoice.amount,
      currency: decision.invoice.currency,
      amountUSD: decision.amountUSD,
      policyHash: policyHash(company),
      decidedAt: decision.decidedAt,
    },
    keys,
  );
}

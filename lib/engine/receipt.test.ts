import { describe, expect, it } from "vitest";
import { canonicalJSON, exportPrivateKey, generateKeys, keysFromPem, policyHash, signReceipt, verifyReceipt } from "./receipt";
import type { Company } from "./types";

const company: Company = {
  company: { name: "Test Co", country: "US", baseCurrency: "USD" },
  policy: { perPaymentLimitUSD: 8000, humanApprovalAboveUSD: 2000, monthlyBudgetUSD: { software: 1000 }, allowedCurrencies: ["USD"], maxDaysUntilDue: 30, duplicateWindowDays: 20 },
  beneficiaries: [{ id: "b2", name: "Nube SaaS Inc.", country: "US", currency: "USD", account: { type: "bank", value: "US-999" }, category: "software" }],
  contracts: [{ id: "c2", beneficiaryId: "b2", concept: "Suscripción", amount: 300, currency: "USD", tolerancePct: 0, frequency: "monthly" }],
  history: [],
};

const payload = { caseId: "case-1", decisionId: "d-1", action: "PAY" as const, reasons: [], invoiceNumber: "NB-1", beneficiaryId: "b2", amount: 300, currency: "USD", amountUSD: 300, policyHash: policyHash(company), decidedAt: "2026-10-17T12:00:00Z" };

describe("receipts", () => {
  it("canonical JSON is independent of key order and drops undefined", () => {
    expect(canonicalJSON({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe('{"a":[{"c":2}],"b":1}');
  });

  it("policy hash changes when a rule changes and not when keys are reordered", () => {
    const reordered = { ...company, policy: { duplicateWindowDays: 20, maxDaysUntilDue: 30, allowedCurrencies: ["USD"], monthlyBudgetUSD: { software: 1000 }, humanApprovalAboveUSD: 2000, perPaymentLimitUSD: 8000 } };
    expect(policyHash(reordered)).toBe(policyHash(company));
    const looser = { ...company, contracts: [{ ...company.contracts[0], tolerancePct: 10 }] };
    expect(policyHash(looser)).not.toBe(policyHash(company));
    // History is not part of the rules.
    expect(policyHash({ ...company, history: [{ invoiceNumber: "X", beneficiaryId: "b2", amount: 1, currency: "USD", paidAt: "2026-10-01", category: "software" }] })).toBe(policyHash(company));
  });

  it("signs and verifies, and detects tampering", () => {
    const keys = generateKeys();
    const r = signReceipt(payload, keys);
    expect(r.alg).toBe("ed25519");
    expect(r.payload.ephemeral).toBe(true);
    expect(verifyReceipt(r)).toBe(true);
    expect(verifyReceipt({ ...r, payload: { ...r.payload, amount: 3000 } })).toBe(false);
    expect(verifyReceipt({ ...r, payload: { ...r.payload, action: "HOLD" } })).toBe(false);
    expect(verifyReceipt({ ...r, signature: r.signature.replace(/^./, (c) => (c === "A" ? "B" : "A")) })).toBe(false);
  });

  it("round-trips a key through the ORBIT_SIGNING_KEY format", () => {
    const keys = generateKeys();
    const restored = keysFromPem(exportPrivateKey(keys));
    expect(restored.ephemeral).toBe(false);
    const r = signReceipt(payload, restored);
    expect(r.payload.ephemeral).toBeUndefined();
    expect(verifyReceipt(r)).toBe(true);
    expect(r.publicKey).toBe(keys.publicKey.export({ type: "spki", format: "pem" }));
  });
});

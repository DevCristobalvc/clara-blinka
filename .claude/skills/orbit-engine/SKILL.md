---
name: orbit-engine
description: How ORBIT's PAY/HOLD/ESCALATE pipeline and the vendor negotiation loop work, and how to change them safely. Use when adding or changing a rule, a reason code, a JEV question or threshold, the extraction schema, a demo invoice or cobrador, a negotiation request type, or when the eval or a safety invariant fails.
---

# ORBIT decision engine

Pipeline (`lib/engine/`):

```
extract.ts     Claude structured output -> Invoice        (uploads only; the dataset is pre-extracted in data/invoices.json)
rules.ts       runRules(ctx) -> RuleResult[]               deterministic: allowlist, bank details, currency, contract match,
                                                            per-payment limit, human threshold, monthly budget, duplicates, due date
jev.ts         judge(input) -> JevAnswers                   one batched JEV call; judgeOffline() heuristic when there is no key
decide.ts      jevReasons() appends failing "jev" rules; actionFor(): any HOLD-severity reason -> HOLD, else any reason -> ESCALATE, else PAY
explain.ts     plain-language Spanish explanation
negotiate.ts   canNegotiate -> openThread -> stepThread*   ORBIT asks the vendor for a correction; corrected invoices re-run decide()
cobrador.ts    cobradorReply(config, request, invoice)      the vendor-side agent, rule-driven (data/cobradores.json overrides)
receipt.ts     receiptFor(caseId, decision, company)        Ed25519 receipt with policyHash (sha256 of policy+beneficiaries+contracts)
ledger.ts      ledgerFor(cases), effectiveDecision()        one payment record per paid case; negotiated decision wins
```

Server side (`lib/server/`): `cases.ts` drives a `Case` through `createCase → submitInvoice → postVendorReply → reviewCase` over a `CaseStore` (`store.ts`: Supabase or memory), appends `case_events` (audit) and emits signed webhooks (`webhooks.ts`).

## Invariants (never weaken)

- `decide()` throws if `action === "PAY"` while any rule fails, any reason exists, or `amountUSD` is NaN.
- JEV can only **add** reasons. Never let a JEV answer remove a rule failure or turn a HOLD/ESCALATE into PAY.
- Negotiation: only `NEGOTIABLE_CODES` (`CONTRACT_MISMATCH, CURRENCY_NOT_ALLOWED, DUPLICATE, DUE_TOO_FAR, LOW_CONFIDENCE` concept-only). Vendor text lands only in `rawText`/display. `buildCorrected` forces `payeeName` and `issueDate`; `validateCorrection` requires same vendor by name, registered account, allowed currency, `toUSD(corrected) <= toUSD(original)` and `<= contract.amount`. The corrected invoice re-runs `decide()` with the session ledger as `extraHistory` (never pass `company.history` again: it would double-count the budget).
- `ProseFacts` has no limit/tolerance/budget/threshold fields; `negotiate.test.ts` asserts templates never leak them.
- Arithmetic, FX (`fx.ts`, static rates; EUR exists only for comparisons), dates and counting stay in code.
- Only escalated cases can be approved by a person (`reviewCase`); held or `needs_human` cases can only be rejected.

## Recipes

**Add a rule**: write a `Rule` in `rules.ts`, add it to `RULES`; new code → `REASON_CODES` (`types.ts`), default in `severity.ts`, label in `labels.ts`, and decide whether it is negotiable (`NEGOTIABLE_CODES`, default no). Tests in `engine.test.ts`.

**Add or tune a JEV question**: `buildQuestions()` in `jev.ts` (`noul` / `choice` with "other" / `score`), map in `JevAnswers`, parse in `judgeWithJev` and `judgeOffline`, turn into a reason in `jevReasons()` with a threshold in `thresholds.ts`. Load `typesafe:typesafe-ai` for the API shape.

**Add a negotiation request type**: `RequestType` + `VendorReplyKind` in `types.ts`; pick it in `pickRequest()`; handle the reply in `stepThread()`; templates in `orbitTemplate`/`vendorTemplate`; teach `cobradorReply` to answer it; label in `components/CasePage.tsx` (`REQUEST_LABEL`).

**Add a demo invoice / cobrador**: append to `data/invoices.json` and `data/expected.json` (`expectedAction`, `reasonCodes`, `expectedResolution`, `note`); for a compromised vendor add a `byFile` override in `data/cobradores.json` (`compromise: { newAccount | injectText | raiseAmountPct }`); render with `CHROME_PATH=… node scripts/render-invoices.mjs`; `npm run eval` must still report 0 unsafe before and after negotiation.

**Change the schema**: edit `db/schema.sql`, apply with the Supabase MCP `apply_migration` on project `clara` (`nzqukgthqjcelyematst`), keep `MemoryStore` in sync, run `lib/server/cases.test.ts`.

## Verify

```bash
npm test                          # 55+ tests: engine, negotiation (incl. 300-case property test), receipts, case service, dataset eval
ORBIT_EVAL_LIVE=1 npm run eval    # live JEV
curl -X POST localhost:3000/api/cases -H 'content-type: application/json' -d '{"source":"invoices/14-lucia-euros.pdf"}'   # then /invoice, /messages {"fromCobrador":true}
```

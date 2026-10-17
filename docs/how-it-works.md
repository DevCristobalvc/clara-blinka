# ORBIT, end to end

What the service is, who the actors are, where the money goes, and what is real versus simulated in the hackathon build. Read this before the code.

## The idea in one paragraph

A company hires AI agents from ORBIT to handle its money flows within rules it sets once. The **pagador** handles what the company owes: it reads each invoice, checks it against the rules, talks to the vendor when something doesn't match, and pays, holds or hands the case to a person. The **cobrador** does the mirror job for what the company is owed (same engine, rules inverted; screens in the next version). Every decision is explained in plain language and signed, so anyone can verify it afterwards. ORBIT sits on top of Blinka: Blinka is the account, the login and the rails; ORBIT is the agents that use them.

## Actors

| Actor | Who | In the demo |
|---|---|---|
| **Company** | A US company paying contractors and vendors in LATAM | "Andes Labs Inc." (fictitious). Logs in through Privy (stand-in for Blinka's login); its embedded wallet is the company's wallet. |
| **ORBIT** | The platform: agents, rules engine, case links, receipts | This repo, deployed on Vercel, cases in Supabase. |
| **Vendor / contractor** | Whoever sends an invoice | A person on the case link. For the demo set, vendor replies are **simulated by rules per vendor** (`data/cobradores.json`), three of them deliberately misbehaving. |
| **A person at the company** | Finance, approving what the rules reserve for humans | The Aprobaciones screen. |

## The three money flows

1. **Hiring the agent (fee → ORBIT).** The company pays ORBIT to activate the pagador or the cobrador. Over HTTP: `POST /api/agents/pagador/activate` answers `402 Payment Required` with the price; the company's wallet signs a USDC authorization; the x402 facilitator settles it on Base Sepolia into ORBIT's treasury (`ORBIT_PAY_TO`); the route then records the activation. No account, no card, no API key. In production the same fee can be billed through Blinka's USD rails, or paid per case by the company's own agent.
2. **Funding the agent (company → the agent's own wallet).** Each company gets a pagador wallet and a cobrador wallet, derived on the server (nothing stored). "Cargar fondos" is the same 402 mechanic with the agent's wallet as the destination. The agent shows its balance and what it has registered as paid. This is the "reload it when you create it" step: the agent holds everything that doesn't match, and only pays what fits.
3. **Paying vendors (recorded, not executed).** The Blinka brief ends at the decision, so ORBIT **records** each approved payment in its ledger (`pago-…` reference, signed receipt) and does not move money. The interface (`PaymentExecutor`) is where a rail plugs in later.

## The rules: the agent's mandate

Set once in **Reglas**, saved on the server, hashed into every receipt:

- max per payment, human-approval threshold, monthly budget per category;
- allowed beneficiaries with their registered account, allowed currencies;
- what each reason does (hold or escalate), which reasons may be negotiated, max rounds;
- JEV thresholds (how sure the model must be).

**The agent can never change these.** Nothing it reads from an invoice, a vendor message or a model answer can loosen a rule; it can only make a decision stricter.

## Life of a case

```
Facturas → Nuevo caso (vendor, contract, optional invoice) ──► link  /c/<id>
                                                                    │
 vendor opens the link, attaches the invoice (PDF/image/email/chat) │  or the company's agent POSTs it
                                                                    ▼
                     1. extract  (Claude, structured output: payee, account, number, dates, currency, amount, concept)
                     2. rules    (deterministic: allowlist, bank details, currency, contract, limits, budget, duplicates, dates)
                     3. judge    (JEV typed questions: concept matches contract? pressure? bank-change request? risk?)
                     4. decide   worst outcome wins: HOLD > ESCALATE > PAY
                                                                    │
            ┌───────────────────────────┬───────────────────────────┼─────────────────────────────┐
            ▼                           ▼                           ▼                             ▼
          PAY                        HOLD, negotiable             HOLD, not negotiable          ESCALATE
   recorded + receipt        5. negotiate: ORBIT asks the       (bank change, pressure…)     a person approves
   status: paid              vendor for one correction;         status: held                 or rejects
                             the vendor answers on the link;    → a person                   status: escalated
                             the corrected invoice is built
                             in code, validated, and goes
                             back to step 2 (max 2 rounds)
                                       │
                 ┌─────────────────────┼──────────────────┬───────────────────┐
                 ▼                     ▼                  ▼                   ▼
          auto_resolved            scheduled            closed               human
       corrected invoice      (due too far: pay     (duplicate confirmed:   (refused, or the
       passes → paid           on the agreed date)    nothing to pay)         correction broke
                                                                              a guardrail)
```

Every step appends an event (`case_events`): messages, decisions, corrections, settlements, reviews, webhook attempts. The company's systems get a signed webhook on each status change.

## Negotiation guardrails (why it can't be gamed)

- Only these reasons are negotiable: contract mismatch, currency not allowed, duplicate, due too far, unclear concept. Never: bank-account change, pressure, unknown vendor, over a limit, budget, past due.
- A correction must come from the same vendor, keep the registered account, stay in an allowed currency, and be **no higher** than the original invoice or the contract.
- The vendor's words never reach a rule. They are shown in the thread and seen by JEV; the corrected invoice is built from structured fields.
- The wording layer (Claude writing the messages) only receives `ProseFacts`, a type that cannot carry limits, budgets or tolerances. A test asserts nothing leaks.
- After two rounds without a result, a person decides.

In the demo set: Lucía's EUR invoice is reissued in USD and paid; Trazo's duplicate is closed; Selina's January rent is scheduled; three vendors try a new account, an injected instruction and a higher amount, and all three end with a person. Ana's +15% is not negotiated because it also exhausts the budget, and budget is a human decision.

## Trust

- **Receipts.** Every decision is signed (Ed25519) with the invoice figures, the outcome and `policyHash` (rules + beneficiaries + contracts in force). Public key at `/api/keys`. Rules are pure functions, so anyone with the inputs can replay the decision; the receipt proves which inputs and which rules.
- **Webhooks.** HMAC-signed (`X-Clara-Signature: t=…,v1=…`), carrying the receipt.
- **Eval.** `npm test` runs the 21-invoice set: 21/21 correct, 0 unsafe payments before and after negotiation, 76% with no human, 3 of 10 holds resolved with the vendor (`docs/eval.md`).

## What is real and what is simulated

| Real | Simulated / scoped out |
|---|---|
| Rules engine, JEV judgments (live key), Claude extraction and wording | Vendor replies in the demo set (rule-driven per vendor; a real vendor uses the link) |
| Supabase cases and audit trail, signed receipts, webhooks | Moving vendor money (recorded only; Blinka's rails in production) |
| Privy login and company wallet; x402 payments in USDC on **Base Sepolia** (testnet) | Blinka's own login (Privy stands in); mainnet money |
| Agent wallets per company (derived addresses, real balances) | The cobrador's screens (next version) |

## Where things live

`lib/engine/` the pipeline and negotiation (pure) · `lib/server/` cases, store, webhooks, agents · `app/api/` routes · `app/app/` the workspace · `app/c/[id]` the vendor's page · `db/schema.sql` · `data/` the demo company and invoices · `docs/eval.md` the numbers · `docs/pitch.md` the video script.

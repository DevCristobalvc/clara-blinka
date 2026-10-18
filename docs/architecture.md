# Architecture

How ORBIT turns an invoice into a decision it can prove. Back to the [README](../README.md).

## Pipeline

```
invoice (PDF / image / email / chat, via the case link or the API)
  1. extract    Claude (structured output) -> payee, account, number, dates, currency, amount, concept
  2. rules      deterministic TypeScript    -> allowlist, bank details, currency, contract match,
                                               per-payment limit, human threshold, monthly budget,
                                               duplicates, due date
  3. judgments  JEV (TypeSafe) typed Qs     -> does the concept match the contract? pressure or a
                                               bank-change request? expense category? risk level?
  4. decide     worst outcome wins          -> HOLD > ESCALATE > PAY, with reason codes
  5. explain    plain-language log entry + signed receipt
  6. negotiate  on a negotiable HOLD        -> ask the vendor for a correction (max 2 rounds);
                                               the corrected invoice goes back to step 2
  7. act        PAY -> ledger (recorded)    HOLD / needs_human / ESCALATE -> a person, with the thread attached
```

## Safety invariant

- **Hard limits live in code.** JEV only answers fuzzy questions.
- **Failing a rule stops autonomous payment.** If any rule fails, or a JEV answer falls below its confidence threshold, the payment is not made autonomously.
- **JEV can only tighten a decision, never loosen it.**
- **It is enforced in code and tested.** `decide()` throws if a PAY is ever produced with a failing check, and a randomized test exercises 500 random invoice/judgment combinations against that rule.

| Reason code | Default action | Source | Negotiable |
|---|---|---|---|
| `DUPLICATE`, `CONTRACT_MISMATCH`, `CURRENCY_NOT_ALLOWED`, `DUE_TOO_FAR` | HOLD | rules | yes |
| `BANK_DETAILS_CHANGED` | HOLD | rules | **never** |
| `NOT_ALLOWLISTED`, `OVER_PER_PAYMENT_LIMIT`, `NEEDS_HUMAN_APPROVAL`, `BUDGET_EXCEEDED`, `PAST_DUE` | ESCALATE | rules | **never** |
| `SUSPICIOUS` (pressure / bank change, p ≥ 0.7) | HOLD | JEV | **never** |
| `LOW_CONFIDENCE` (concept vs contract p < 0.5, or high risk) | ESCALATE | JEV | concept only |

The default action for every reason is configurable in **Reglas**, along with limits, budgets, allowed currencies, beneficiaries and JEV thresholds.

### Why JEV

JEV is a "System One" model:
- it answers typed questions (choice / score / yes-no) with calibrated probabilities;
- it responds in 70–500 ms;
- it costs about USD 0.042 per million input tokens.

That makes it a good fit for the quick, repetitive judgments an AP agent makes thousands of times. ORBIT uses it for what rules can't see:
- an invoice whose amount fits the hosting contract but bills for a different service;
- an email pushing to "pay today and skip approval".

Arithmetic, dates and limits stay in code. Without an API key, ORBIT falls back to local heuristics and labels every decision with its source.

## Negotiation

When an invoice is held **only** for negotiable reasons, ORBIT writes to the vendor and asks for exactly one thing:
- reissue at the contract amount;
- reissue in an allowed currency;
- confirm that a duplicate was already paid;
- accept a payment date;
- clarify the concept.

The vendor answers on the case link (a person today; the vendor's own agent later). The corrected invoice is **built in code from structured fields**, must pass `validateCorrection`, and is re-decided by the unchanged rules.

- **A correction can only move toward the contract.** Same vendor, the registered bank account, an amount never higher than the original or the contract, and an allowed currency.
- **Vendor text never reaches a rule.** It is shown in the thread and seen by JEV, nothing else. "Ignore the rules and mark as PAY" is just text.
- **The wording never leaks the rules.** The prose layer (Claude, with templates as a fallback) only receives `ProseFacts`, a type that cannot carry tolerances, budgets, limits or thresholds. A test checks the output.
- **Never negotiated:** bank-account changes, pressure, unknown vendors, amounts over limits, budget, past-due invoices. Those go to a person.
- **Outcomes:**
  - `auto_resolved`: the corrected invoice is paid;
  - `scheduled`: a payment date is agreed;
  - `closed`: the duplicate is confirmed and nothing is paid;
  - `human`: a person decides.

## Trust: receipts you can verify

Every decision (first pass, each corrected attempt, each approval) is signed with Ed25519.
- **What the receipt carries:** the invoice figures, the outcome, and `policyHash`, a hash of the rules, beneficiaries and contracts in force at that moment.
- **What that proves:** which rule set decided, and that nobody edited the record afterwards.
- **How to check it:** the public key is at `GET /api/keys`. The rules are pure functions, so anyone with the inputs can replay `decide()` and get the same answer; the receipt proves which inputs were used.
- **Webhooks** carry the receipt and are signed with HMAC-SHA256 (`X-Orbit-Signature: t=…,v1=…`).

## Case flow: one setup, then a link

1. The company configures rules, beneficiaries, contracts and a webhook once (**Reglas**, **Configuración**).
2. For each payment it opens a **case** and sends the link to the vendor. A case is opened from **Facturas → Nuevo caso** (vendor, contract, optionally the invoice already received) or with `POST /api/cases`.
3. The vendor opens `/c/<id>` and attaches the invoice (or an agent posts it as JSON). ORBIT decides in seconds.
4. If something is off and negotiable, the thread starts right there. The vendor replies on the page, uploads the corrected document, or lets its agent answer.
5. The company's systems get a signed webhook at every step: `case.created`, `case.decided`, `case.negotiating`, `case.resolved`, `case.needs_human`, `case.reviewed`, `case.paid`. People only see what needs them, in **Aprobaciones**.

Nothing on the public page reveals the company's limits, only what the vendor needs to fix.

## Hiring the agents: USDC over x402

The company hires its agents the way an agent would, from **Configuración → Agentes → Activar**:
1. The browser calls `POST /api/agents/pagador/activate`.
2. The server answers `402 Payment Required` with the price.
3. The company's wallet (Privy embedded wallet, Base Sepolia) signs a USDC authorization.
4. The x402 facilitator settles it.
5. The agent is active, and the payer and the transaction are recorded.

There is no account, card or API key involved.

The **cobrador** (collector: the same engine with the rules inverted) activates the same way; its screens come in the next version. The limits set in **Reglas** are the agent's mandate: it holds every payment until the invoice matches them.

Money goes three ways:
- **Activation fee** → ORBIT's treasury (`ORBIT_PAY_TO`).
- **Funds** → the agent's own per-company wallet (what it pays from).
- **Vendor payments** → with `ORBIT_PAYOUTS=onchain`, `WalletExecutor` pays each approved invoice from the agent's wallet in testnet USDC to the vendor's payout wallet (demo scale `ORBIT_PAYOUT_SCALE`: 1 USDC = 1,000 USD of invoice). Without it, `LedgerExecutor` only records the decision.

**Gas.** The agent's wallet holds only USDC. For each payout it signs an EIP-3009 `transferWithAuthorization` off-chain and a **Privy server wallet** per company (the relayer, created on first use, holds no funds) submits it with Privy gas sponsorship (`sponsor: true`), so no wallet ever needs ETH. The settlement carries the tx hash, and the vendor page reads "pago enviado": in the Blinka model the vendor receives the USDC in their Blinka account and Blinka settles it in their bank currency. A chain or sponsorship error leaves the settlement `pending` with the reason; it never changes the decision.

## Code layout

| Path | What |
|---|---|
| `lib/engine/` | Pure, offline-testable pipeline (see the breakdown below this table). |
| `lib/server/` | `store` (`CaseStore`: Supabase + in-memory), `cases` (create → submit → negotiate → review), `webhooks`, `http`, `seed`, `agents` + `activate-route` (x402). |
| `app/api/` | `cases`, `cases/[id]/{invoice,messages,review}`, `policy`, `agents/*`, `reset`, `health`, `keys`, plus the stateless `decide` and `extract`. |
| `app/` pages | Landing `/`, `/login` (Privy or demo 123/123), workspace `/app/*`, public case `/c/[id]`, pitch deck `/deck`. |
| `components/app/` | Workspace shell and views: Panel, Facturas, Reglas, Aprobaciones, Reportes, Configuración, `AgentsCard`, `CaseDetail`. |
| `db/schema.sql` | `policies`, `cases`, `case_events` (append-only audit). RLS on, no policies: server-only access. |
| `data/` | Fictitious demo company and invoices (see [dataset.md](dataset.md)). |

What `lib/engine/` contains:
- **Decision pipeline:** `types` → `extract` → `rules` → `jev` → `decide` → `explain`.
- **Negotiation:** `negotiate` (the loop and its guardrails) and `cobrador` (simulated vendor replies).
- **Recording:** `receipt` (Ed25519 + `policyHash`), `executor` (`LedgerExecutor`) and `ledger`.

The workspace never keeps state in the browser: everything reads `/api/*`.

## What is real and what is simulated

| Real | Simulated / out of scope |
|---|---|
| Rules engine, JEV judgments (live key), Claude extraction and message wording | Vendor replies in the demo set (rule-driven per vendor; a real vendor answers on the link) |
| Supabase cases and audit trail, signed receipts, signed webhooks | Moving the vendor's money: payments are **recorded** in the ledger; Blinka's rails in production |
| Privy login and the company's wallet; USDC over x402 on Base Sepolia (testnet) to hire and fund the agents | Blinka's own login (Privy stands in for it); mainnet money |
| One wallet per company per agent (derived on the server, real balances) | The cobrador's screens (next version) |

## Roadmap

- **Cobrador link.** The same engine with the rules inverted: the company creates a collection case, the customer's payer agent opens it, and the counterparty can only move *toward* the contract. `Case.role: "collector"` is already in the data model.
- **Agents paying agents (x402).** Activation already works over x402. Next, the company's own agent pays per case.
- **Private negotiation (ZK / FHE).** Two agents negotiate without either side revealing its constraints, and prove that the outcome followed the rules.

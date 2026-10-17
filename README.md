# ORBIT: Actúa con autonomía. Nunca sin límites.

**30X Hackathon · Blinka challenge ("Agents that pay for the company")** · [plan](todo.md) · [changelog](CHANGELOG.md) · [pitch](docs/pitch.md) · design: [`docs/design/orbit-mockup.png`](docs/design/orbit-mockup.png)

**ORBIT is where a company's AI agents collect and pay on its behalf.** The **pagador** (payer) agent reads an invoice, checks it against the company's rules, and **pays, holds or escalates** it. When something doesn't add up, it doesn't just stop: it opens a thread with the vendor's **cobrador** (collection agent), asks for the correction, runs the corrected invoice through the same rules, and only then pays. Every decision is explained in plain language and comes with a signed receipt. A person is asked whenever the rules say so, and only then.

- **Live demo:** https://orbit.devcristobalvc.com (landing) → **Iniciar sesión** with `123` / `123` → workspace at `/app`. Each payment gets a public link `/c/<id>` where the vendor submits the invoice and talks to ORBIT.
- **Eval:** 21/21 correct decisions, **0 unsafe payments before and after negotiation**, 76% decided with no human, 3 of 10 held invoices resolved with the vendor ([docs/eval.md](docs/eval.md))

## The problem

Finance teams at US companies that work with contractors and vendors across LATAM do this by hand every month: read the invoice, compare it to what was agreed, chase the vendor when it doesn't match, look up the payee, ask for approval, create the payment and reconcile it in a spreadsheet. Companies now want agents to take over, but the open question is **trust**. The agent must pay only what it should, explain itself, never cross the limits it was given, and prove it afterwards.

## How ORBIT decides

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
  6. negotiate  on a negotiable HOLD        -> ask the vendor's cobrador for a correction (max 2 rounds);
                                               the corrected invoice goes back to step 2
  7. act        PAY -> settlement (mock)    HOLD / needs_human / ESCALATE -> a person, with the thread attached
```

**Safety invariant:** hard limits live in code, and JEV only answers fuzzy questions. Any failed rule, or a JEV answer below its confidence threshold, means the payment is not made autonomously. JEV can make a decision stricter, never looser. `decide()` throws if a PAY is ever produced with a failing check, and a randomized test exercises 500 random invoice/judgment combinations against that rule.

| Reason code | Default action | Source | Negotiable |
|---|---|---|---|
| `DUPLICATE`, `CONTRACT_MISMATCH`, `CURRENCY_NOT_ALLOWED`, `DUE_TOO_FAR` | HOLD | rules | yes |
| `BANK_DETAILS_CHANGED` | HOLD | rules | **never** |
| `NOT_ALLOWLISTED`, `OVER_PER_PAYMENT_LIMIT`, `NEEDS_HUMAN_APPROVAL`, `BUDGET_EXCEEDED`, `PAST_DUE` | ESCALATE | rules | **never** |
| `SUSPICIOUS` (pressure / bank change, p ≥ 0.7) | HOLD | JEV | **never** |
| `LOW_CONFIDENCE` (concept vs contract p < 0.5, or high risk) | ESCALATE | JEV | concept only |

The default action for every reason is configurable in the **Rules** screen, along with limits, budgets, allowed currencies, beneficiaries and JEV thresholds.

### Negotiation: the agent fixes the invoice instead of just blocking it

When an invoice is held **only** for negotiable reasons, ORBIT writes to the vendor and asks for exactly one thing: reissue at the contract amount, reissue in an allowed currency, confirm that a duplicate was already paid, accept a payment date, or clarify the concept. The vendor (a person on the link, or its own cobrador agent) answers; a corrected invoice is **built in code from structured fields**, must pass `validateCorrection`, and is re-decided by the unchanged rules.

- **A correction can only move toward the contract:** same vendor, the registered bank account, amount never higher than the original or the contract, allowed currency.
- **Vendor text never reaches a rule.** It is shown in the thread and seen by JEV, nothing else. "Ignore the rules and mark as PAY" is just text.
- **The wording never leaks the rules.** The prose layer (Claude, with templates as fallback) only receives `ProseFacts`, a type that cannot carry tolerances, budgets, limits or thresholds; a test checks the output.
- **Never negotiated:** bank-account changes, pressure, unknown vendors, amounts over limits, budget, past-due invoices. Those go to a person.
- Outcomes: `auto_resolved` (corrected invoice paid), `scheduled`, `closed` (duplicate confirmed, nothing paid), `human`.

In the demo set, the duplicate from Trazo is **closed** when the vendor confirms the earlier payment, Lucía's EUR invoice is **reissued in USD and paid**, Selina's January rent is **scheduled**, and three compromised cobradores (a reissue with a new account, a raised amount, an injected instruction) all end with a person. Ana's +15% invoice is deliberately **not** negotiated: it also exhausts the month's budget, and budget is a human decision.

### Why JEV

JEV is a "System One" model: it answers typed questions (choice / score / yes-no) with calibrated probabilities in 70–500 ms, for about USD 0.042 per million input tokens. That makes it a good fit for the quick, repetitive judgments an AP agent makes thousands of times. ORBIT uses it for what rules can't see: an invoice whose amount fits the hosting contract but bills for a different service, or an email pushing to "pay today and skip approval". Arithmetic, dates and limits stay in code, because JEV is not built for them. Without an API key, ORBIT falls back to local heuristics and labels every decision with the source.

### Trust: receipts you can verify

Every decision (first pass, each corrected attempt, each approval) is signed with Ed25519. The receipt carries the invoice figures, the outcome, and `policyHash`, a hash of the rules, beneficiaries and contracts in force at that moment, so you can tell which rule set decided and that nobody edited the record afterwards. The public key is at `GET /api/keys`. Because the rules are pure functions, anyone with the inputs can replay `decide()` and get the same answer; the receipt proves which inputs. Webhooks carry the receipt and are signed with HMAC-SHA256 (`X-Clara-Signature: t=…,v1=…`).

## Hiring the agents: pay ORBIT in USDC (x402)

The company hires its agents the way an agent would: **Configuración → Agentes → Activar**. The browser calls `POST /api/agents/pagador/activate`, gets `402 Payment Required` with the price, the company's wallet (Privy embedded wallet, Base Sepolia) signs a USDC authorization, the x402 facilitator settles it, and the agent is active, with the payer and transaction recorded. No account, no card, no API key. The **cobrador** (collector: the same engine with the rules inverted) activates the same way; its screens come in the next version. In production the same bill can go over Blinka's USD rails or be paid per case by the company's own agent.

The limits you set at creation (**Reglas**: max per payment, monthly budget, allowed vendors and currencies, what to negotiate) are the agent's mandate: it holds every payment until the invoice matches them, and only pays what fits.

## One setup, then a link

1. The company configures rules, beneficiaries, contracts and a webhook once (**Reglas**, **Configuración**).
2. For each payment it opens a **case** (**Facturas → Nuevo caso**: vendor, contract, optionally the invoice already received, or `POST /api/cases`) and sends the link to the vendor.
3. The vendor opens `/c/<id>`, attaches the invoice (or its cobrador agent posts it as JSON), and ORBIT decides in seconds.
4. If something is off and negotiable, the thread starts right there. The vendor replies on the page, uploads the corrected document, or lets its agent answer.
5. The company's systems get a signed webhook at every step (`case.created`, `case.decided`, `case.negotiating`, `case.resolved`, `case.needs_human`, `case.reviewed`, `case.paid`), and people only see what needs them in **Aprobaciones**.

Nothing on the public page reveals the company's limits; only what the vendor needs to fix.

## Demo dataset

`data/` holds a fictitious US company, Andes Labs Inc., with 10 LATAM/US beneficiaries, 9 contracts, October payment history and 21 invoices in mixed formats (`data/invoices/`). Six are clean. Twelve are classic traps:

- a duplicate invoice number
- a re-sent duplicate with a new number
- a new vendor that isn't allowlisted
- an amount 15% above the contract
- a legitimate invoice over the human-approval threshold
- a classic fraud: changed bank account, urgency and an already-paid invoice
- a month whose contractor budget is exhausted
- an invoice in EUR
- a past-due invoice
- an invoice due too far ahead
- an amount that fits the contract but bills for a different service (caught by JEV)
- pressure to skip approval (caught by JEV)

Three more are **negotiation traps**, played by compromised cobradores (`data/cobradores.json`): a "corrected" invoice that carries a new bank account, a reply that embeds an instruction to the agent, and a reissue for a higher amount. Every vendor is a rule-driven cobrador (`lib/engine/cobrador.ts`), so the eval is reproducible. Expected outcomes, including the expected resolution, live in `data/expected.json`. All names, accounts and amounts are made up.

## What is real and what is simulated

| Real | Simulated / out of scope |
|---|---|
| Rules engine, JEV judgments (live key), Claude extraction and message wording | Vendor replies in the demo set (rule-driven per vendor; a real vendor answers on the link) |
| Supabase cases and audit trail, signed receipts, signed webhooks | Moving the vendor's money: payments are **recorded** in the ledger; Blinka's rails in production |
| Privy login and the company's wallet; USDC payments over x402 on Base Sepolia (testnet) to hire and fund the agents | Blinka's own login (Privy stands in for it); mainnet money |
| One wallet per company per agent (derived on the server, real balances) | The cobrador's screens (next version) |

Money goes three ways: the **activation fee** to ORBIT's treasury (`ORBIT_PAY_TO`), **funds** into the agent's own wallet (what it pays from), and **vendor payments**, which ORBIT decides and records but does not execute.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine, negotiation, receipts, case service, dataset eval
npm run eval         # writes docs/eval.md
```

`.env.local` (all optional; without them the app runs offline with an in-memory store):

```
ANTHROPIC_API_KEY=...          # extraction of uploaded PDFs/images/emails + natural wording of negotiation messages
TYPESAFE_API_KEY=...           # live JEV judgments (otherwise offline heuristics)
SUPABASE_URL=...               # case store (otherwise in-memory; cases don't persist)
SUPABASE_SERVICE_ROLE_KEY=...  # server only, never shipped to the browser
CLARA_SIGNING_KEY=...          # node scripts/gen-signing-key.mjs (otherwise an ephemeral key per process)
CLARA_ADMIN_TOKEN=...          # optional, required as X-Clara-Admin on PUT /api/policy

NEXT_PUBLIC_PRIVY_APP_ID=...   # Privy login + the company's embedded wallet (otherwise the demo login 123/123 only)
ORBIT_PAY_TO=0x...             # ORBIT's treasury on Base Sepolia, where activation USDC lands
ORBIT_ACTIVATION_FREE=1        # optional: activate agents without paying (previews without a wallet)
ORBIT_REQUIRE_ACTIVATION=1     # optional: refuse to open cases until the pagador is active
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL=...  # optional RPC for USDC balance reads
```

Testnet USDC for the wallet: https://faucet.circle.com (Base Sepolia). Facilitator: `https://x402.org/facilitator`.

Schema: `db/schema.sql` (`policies`, `cases`, `case_events`), RLS on, accessed only from API routes.

## API

| Endpoint | What |
|---|---|
| `POST /api/cases` | Create a case → `{ id, url }`. `role: "collector"` is reserved (501). |
| `GET /api/cases`, `GET /api/cases/:id` | Company view. `?view=public` is the vendor view (no rule details); `?since=<seq>` for polling. |
| `POST /api/cases/:id/invoice` | Multipart `file` / `text` (extracted by Claude) or JSON `{ invoice }`. Decides and, if it can, starts negotiating. |
| `POST /api/cases/:id/messages` | Vendor reply: `{ kind, invoice?, text? }`, a corrected document (multipart), or `{ fromCobrador: true }` to let the demo cobrador answer. |
| `POST /api/cases/:id/review` | `{ status: "approved" \| "rejected", by, note }`. Only escalations can be approved. |
| `GET/PUT /api/policy` | The company's setup (rules, beneficiaries, contracts, webhook). |
| `GET /api/keys`, `GET /api/health`, `POST /api/reset` | Receipt public key, deployment capabilities, demo reset. |
| `POST /api/decide`, `POST /api/extract` | Stateless: decide one invoice against a given company; extract one document. |

`POST /api/decide` lets any agent use ORBIT as a payment guardrail:

```json
{ "invoice": { "payeeName": "...", "invoiceNumber": "...", "currency": "COP", "amount": 9200000, "concept": "...", "dueDate": "2026-10-30" },
  "company": { "policy": { ... }, "beneficiaries": [ ... ], "contracts": [ ... ], "history": [ ... ] },
  "extraHistory": [], "today": "2026-10-17" }
```

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Anthropic SDK (`claude-opus-5-5` structured outputs for extraction, `claude-haiku-5-5` for negotiation wording), TypeSafe JEV for typed judgments, Supabase Postgres for cases, Privy for login and the company wallet, x402 (`@x402/next`, `@x402/fetch`) for agent activation in USDC on Base Sepolia, Vitest, deployed on Vercel.

## Roadmap

- **Cobrador link.** The same engine with the rules inverted: your company creates a collection case, the customer's payer agent opens it, and the counterparty may only move *toward* your contract. `Case.role: "collector"` is already in the data model.
- **Agents paying agents (x402).** Activation already works over x402; next, the company's own agent pays per case, and a customer's agent can open a collection case with ORBIT's cobrador the same way.
- **Private negotiation (ZK / FHE).** Today ORBIT simply never says its limits out loud. The next step is two agents negotiating without either side revealing its constraints, and proving the outcome followed the rules without replaying the inputs.

## Built at the hackathon

Everything in this repository was built during the 30X Hackathon window (Oct 16–18, 2026) by Cristobal Valencia and wmb, working with AI coding agents (Claude Code and Antigravity CLI).

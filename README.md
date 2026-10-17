# Clara: the AP agent that only pays what it should

**30X Hackathon · Blinka challenge ("Agents that pay for the company")**

Clara reads a company's invoices (PDF, image, email or chat) and decides, for each one, whether to **PAY**, **HOLD** or **ESCALATE** it to a person. It works inside rules the company configures, never approves a payment outside those rules without a human, and explains every decision in plain language.

- **Live demo:** https://clara-kohl.vercel.app
- **Eval:** 18/18 correct decisions, 0 unsafe payments, 72% decided with no human ([docs/eval.md](docs/eval.md))

## The problem

Finance teams at US companies that work with contractors and vendors across LATAM do this by hand every month: read the invoice, compare it to what was agreed, look up the payee, ask for approval, create the payment and reconcile it in a spreadsheet. Companies now want agents to take over, but the open question is **trust**. The agent must pay only what it should, explain itself and never cross the limits it was given.

## How Clara decides

```
invoice (PDF / image / email / chat)
  1. extract    Claude (structured output) -> payee, account, number, dates, currency, amount, concept
  2. rules      deterministic TypeScript    -> allowlist, bank details, currency, contract match,
                                               per-payment limit, human threshold, monthly budget,
                                               duplicates, due date
  3. judgments  JEV (TypeSafe) typed Qs     -> does the concept match the contract? pressure or a
                                               bank-change request? expense category? risk level?
  4. decide     worst outcome wins          -> HOLD > ESCALATE > PAY, with reason codes
  5. explain    plain-language log entry + human approval queue for escalations
```

**Safety invariant:** hard limits live in code, and JEV only answers fuzzy questions. Any failed rule, or a JEV answer below its confidence threshold, means the payment is not made autonomously. JEV can make a decision stricter, never looser. `decide()` throws if a PAY is ever produced with a failing check, and a randomized test exercises 500 random invoice/judgment combinations against that rule.

| Reason code | Default action | Source |
|---|---|---|
| `DUPLICATE`, `BANK_DETAILS_CHANGED`, `CONTRACT_MISMATCH`, `CURRENCY_NOT_ALLOWED`, `DUE_TOO_FAR` | HOLD | rules |
| `NOT_ALLOWLISTED`, `OVER_PER_PAYMENT_LIMIT`, `NEEDS_HUMAN_APPROVAL`, `BUDGET_EXCEEDED`, `PAST_DUE` | ESCALATE | rules |
| `SUSPICIOUS` (pressure / bank change, p ≥ 0.7) | HOLD | JEV |
| `LOW_CONFIDENCE` (concept vs contract p < 0.5, or high risk) | ESCALATE | JEV |

The default action for every reason is configurable in the **Rules** screen, along with limits, budgets, allowed currencies, beneficiaries and JEV thresholds.

### Why JEV

JEV is a "System One" model: it answers typed questions (choice / score / yes-no) with calibrated probabilities in 70–500 ms, for about USD 0.042 per million input tokens. That makes it a good fit for the quick, repetitive judgments an AP agent makes thousands of times. Clara uses it for what rules can't see: an invoice whose amount fits the hosting contract but bills for a different service, or an email pushing to "pay today and skip approval". Arithmetic, dates and limits stay in code, because JEV is not built for them. Without an API key, Clara falls back to local heuristics and labels every decision with the source.

## Demo dataset

`data/` holds a fictitious US company, Andes Labs Inc., with 10 LATAM/US beneficiaries, 9 contracts, October payment history and 18 invoices in mixed formats (`data/invoices/`). Six of the invoices are clean. The other twelve are traps:

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

The expected outcomes live in `data/expected.json`. All names, accounts and amounts are made up.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # engine unit tests + dataset eval
npm run eval         # writes docs/eval.md
```

Optional `.env.local`:

```
TYPESAFE_API_KEY=...    # live JEV judgments (otherwise offline heuristics)
ANTHROPIC_API_KEY=...   # extraction of uploaded PDFs/images/emails
```

## API

`POST /api/decide` is stateless, so other agents can call Clara as a payment guardrail:

```json
{ "invoice": { "payeeName": "...", "invoiceNumber": "...", "currency": "COP", "amount": 9200000, "concept": "...", "dueDate": "2026-10-30" },
  "company": { "policy": { ... }, "beneficiaries": [ ... ], "contracts": [ ... ], "history": [ ... ] },
  "extraHistory": [], "today": "2026-10-17" }
```

It returns `{ action, reasons, rules[], jev, explanation, amountUSD, ... }`. `POST /api/extract` (multipart `file`, or `text` + `channel`) returns the extracted invoice.

## Stack

Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Anthropic SDK (`claude-opus-5-5` structured outputs) for extraction, TypeSafe JEV for typed judgments, Vitest, deployed on Vercel. Decision state lives in the browser (localStorage), so there is no database to manage.

## Built at the hackathon

Everything in this repository was built during the 30X Hackathon window (Oct 16–18, 2026) by Cristobal Valencia, working with AI coding agents (Claude Code and Antigravity CLI).

# ORBIT: AP agent with guardrails (todo)

**30X Hackathon, Blinka challenge** ("Agents that pay for the company"). Deadline **Sun Oct 18, 12:00 COT**. Uses **JEV (TypeSafe)** as the fast decision layer. (The PayBox Chapter 1 submission was cancelled on Oct 17.)

**Pitch:** ORBIT reads a company's invoices and decides, for each one, whether to **PAY**, **HOLD** or **ESCALATE** to a human, inside rules the company defines. It never approves a payment outside the rules without a human, and it explains every decision in plain language.

## Architecture

```
invoice (PDF / image / email / chat)
   -> extract   (LLM via Vercel AI Gateway)     -> Invoice {payee, amount, currency, due, ...}
   -> rules     (deterministic TS: limits, budget, allowlist, duplicates, contract match, dates)
   -> judgments (JEV typed questions: concept matches contract? category? risk?) + confidence thresholds
   -> decide    PAY | HOLD | ESCALATE + reason codes
   -> explain   (human-readable log entry; LLM optional)
   -> audit log (persisted)
   -> human approval queue for ESCALATE (approve / reject, counts against budget)
```

The core rule: **hard limits live in code, JEV only answers fuzzy questions, and any rule failure or low confidence means the payment is not made autonomously.**

Repo layout: Next.js app at the root (`app/`, `lib/engine/`), plus `data/` (mock dataset) and `docs/`.

Owners: **claude** (`30x1`), **agy** (`30agy`), **cristobal** (human-only steps: accounts, API keys, submissions, video voice).

---

## T0: Repo + scaffold
- **Description:** git repo (personal identity), Next.js + TS + Tailwind at the root, folders `lib/engine`, `data`, `docs`. `.comms/` and `.env*` git-ignored. Private GitHub repo `DevCristobalvc/clara`, made public before the 30X submission.
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** `npm run dev` serves a page. Repo pushed. No secrets committed.
- **Tests:** `npm run build` passes.
- **Comments:** Public repo https://github.com/DevCristobalvc/orbit. Commits as DevCristobalvc.

## T1: Mock dataset (fictitious company)
- **Description:** A fictitious US company operating in LATAM (e.g. "Andes Labs Inc."). Includes `data/company.json` (policy: per-payment limit, monthly budget per category, human-approval threshold, allowlisted beneficiaries with wallet/bank, contracts with agreed amounts and tolerance), and 16–20 invoices in mixed formats in `data/invoices/` (PDF, PNG, `.eml`, chat `.txt`) in USD/COP/MXN/BRL. Trap cases required: duplicate charge, new non-allowlisted beneficiary, amount not matching the contract, over limit (needs human), insufficient period budget, plus a few subtle ones (changed bank details, wrong currency, past-due date, vague concept). `data/expected.json` holds the ground-truth action and reason per invoice.
- **Owner:** agy
- **Status:** done
- **Acceptance criteria:** Every trap case listed in the Blinka brief is present. Each invoice has an expected action. No real people or companies.
- **Tests:** The engine eval (T7) runs over the full set.
- **Comments:** Owner changed to claude to unblock. 18 invoices (6 PAY, 12 traps) in `data/invoices.json` + rendered PDF/PNG/EML/TXT via `scripts/render-invoices.mjs`.

## T2: Deterministic rules engine
- **Description:** `lib/engine/rules.ts`, a set of pure functions over `(invoice, policy, history)`: `allowlist`, `per_payment_limit`, `human_threshold`, `period_budget`, `duplicate` (same payee + amount + invoice number, or the same amount within N days), `contract_match` (amount within tolerance), `bank_details_changed`, `currency_allowed`, `due_date` (past-due or too far out). Each returns `{rule, pass, severity: block|escalate|info, detail}`. FX conversion to USD uses static rates.
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** Pure and deterministic. All arithmetic and dates happen here, never in the LLM or JEV.
- **Tests:** vitest with one test per rule (pass and fail).
- **Comments:** 18 unit tests incl. randomized safety invariant. Duplicates by amount compare issue dates (recurring fees).

## T3: JEV judgments
- **Description:** `lib/engine/jev.ts`, a client for `POST https://api.typesafe.ai/v1/systemone` (model `jev-latest`). It runs one batched call per invoice:
  - `concept_matches_contract` (noul)
  - `expense_category` (choice + "other")
  - `risk_level` (score: low/medium/high)
  - `looks_like_social_engineering` (noul: urgency, changed bank details, pressure)

  Configurable thresholds. With no API key it falls back to an offline heuristic marked `source: "offline"`, so the demo never breaks.
- **Owner:** claude
- **Status:** in-progress
- **Acceptance criteria:** Under 1 s per invoice. Answers carry probabilities. A confidence below the threshold yields ESCALATE, never PAY.
- **Tests:** Unit tests with a mocked fetch. One live smoke test when the key exists.
- **Comments:** Client + offline fallback done. Live JEV smoke test pending `TYPESAFE_API_KEY`.

## T4: Invoice extraction
- **Description:** `lib/engine/extract.ts`. PDF, image, email or chat text goes to an LLM with structured output (AI SDK `generateObject` with a zod `Invoice`), through Vercel AI Gateway. Fields: payee name, payee account/wallet, invoice number, issue date, due date, currency, amount, line items, concept, and the source channel.
- **Owner:** claude
- **Status:** in-progress
- **Acceptance criteria:** All dataset invoices are extracted correctly. Extraction and decision are separate steps, and the LLM never decides payment.
- **Tests:** Snapshot over the dataset, with the expected fields in `data/expected.json`.
- **Comments:** Uses the Anthropic SDK (`claude-opus-5-5`, structured outputs, `fallbacks: "default"`). Pending `ANTHROPIC_API_KEY` (local + Vercel). Demo set uses ground-truth fields from `data/invoices.json`.

## T5: Decision + explanation + audit log
- **Description:** `lib/engine/decide.ts` combines rules and JEV into `PAY | HOLD | ESCALATE`, with precedence `block` > `escalate` > JEV low confidence > PAY. It returns reason codes and a plain-language explanation built from a template, with an optional LLM rewrite. Each decision is persisted with its inputs, rule results, JEV answers and policy version.
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** **No PAY is possible if any rule fails** (safety invariant). Every decision is explainable without reading code.
- **Tests:** A property test: random invoices and policies never produce PAY while a blocking or escalating rule fails.
- **Comments:** Template explanation in Spanish; invariant enforced in `decide()`.

## T6: Persistence + API
- **Description:** Upstash Redis (Vercel Marketplace) with an in-memory fallback. Routes:
  - `POST /api/invoices` (upload, extract, decide)
  - `GET /api/decisions`
  - `POST /api/decisions/:id/approve|reject` (the human)
  - `GET/PUT /api/policy`
  - `POST /api/v1/check` (public JSON check, so other agents can call ORBIT as a guardrail, < 2 s)
  - `POST /api/reset` (demo reset)
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** Approved escalations count against the budget. Duplicates are detected against history.
- **Tests:** Route tests with the in-memory store.
- **Comments:** Changed: stateless `POST /api/decide` + client ledger in localStorage (no DB needed). `POST /api/extract` for uploads.

## T7: Eval harness
- **Description:** `npm run eval` runs the engine over `data/` and reports autonomy (% decided correctly without a human), safety (number of unsafe PAYs, which must be 0) and explainability (every decision has reasons). The results are shown in the UI.
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** Safety = 0 unsafe PAYs. Results are printed and saved to `docs/eval.md`.
- **Tests:** Runs in CI or locally.
- **Comments:** `npm run eval`: 18/18 correct, 72% autonomy, 0 unsafe payments (offline judge). Report in `docs/eval.md`.

## T8: UI
- **Description:** A simple, clean interface:
  - **Rules** screen: edit limits, budget, threshold and allowlist.
  - **Inbox**: upload or paste an invoice, or load the dataset.
  - **Board**: Paid / Held / Pending approval columns, with counts and spend vs budget.
  - **Decision detail**: extracted fields, rule checklist, JEV answers with probabilities, explanation, approve/reject.
  - **Audit log.**

  UI copy in Spanish for the 30X demo (code in English).
- **Owner:** claude (layout + API wiring); agy can take styling and polish after T6 contracts are frozen
- **Status:** done
- **Acceptance criteria:** An end-to-end demo of the dataset fits in about 2 minutes.
- **Tests:** Manual run plus a Playwright smoke test.
- **Comments:** Board, decision detail with approve/reject, rules editor, audit log (CSV/JSON export), eval tab. Verified headless E2E.

## T9: Deploy
- **Description:** Vercel project `orbit`, with env vars `TYPESAFE_API_KEY` and AI Gateway configured.
- **Owner:** claude (CLI), cristobal (any secret entry)
- **Status:** in-progress
- **Acceptance criteria:** A public URL works end to end.
- **Tests:** Smoke test against prod.
- **Comments:** Live at https://orbit.devcristobalvc.com. Pending env vars `TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY` in Vercel.

## T10: Demo video (30X)
- **Description:** A 2–3 min pitch + demo video. The board processes the dataset: clean invoices get paid; the duplicate, new beneficiary and contract mismatch are held; the over-limit one is escalated and a human approves it. Then the audit log explains each decision, and the eval shows 0 unsafe payments.
- **Owner:** claude (script + automated screen recording), cristobal (voice)
- **Status:** todo
- **Acceptance criteria:** Uploaded (YouTube/Loom) and linked in the README and HackRadar.
- **Tests:** n/a
- **Comments:**

## T13: JEV playbook (30X bonus)
- **Description:** `docs/jev-playbook.md`, at most 5 pages: the decisions JEV makes in ORBIT, the typed question schema, thresholds, when it hands off to a human or an LLM, who operates it, and how success is measured.
- **Owner:** agy (draft), claude (review)
- **Status:** todo
- **Acceptance criteria:** Matches the real questions and thresholds in `lib/engine/jev.ts`.
- **Tests:** n/a
- **Comments:**

## T14: README + pitch
- **Description:** README covering the problem, demo link, architecture, safety invariant, eval results, how to run, and what was built during the hackathon window. Plus a pitch script (2–3 min) and a 30X demo video.
- **Owner:** agy (draft), claude (final), cristobal (voice)
- **Status:** todo
- **Acceptance criteria:** A judge understands the project in 60 s.
- **Tests:** n/a
- **Comments:**

## T15: 30X submission (HackRadar)
- **Description:** Create a solo team, fill in the project (name, challenge = Blinka, description, links: repo, demo, video), and make the repo public. Submit before **Sun 12:00 COT**.
- **Owner:** cristobal (confirm each submit), claude (fill in the form)
- **Status:** todo
- **Acceptance criteria:** The HackRadar project shows as submitted.
- **Tests:** n/a
- **Comments:**

---

## Clara v2 (Oct 17, after ideation): "Agentes de IA que cobran y pagan por tu empresa"

One setup (rules, vendors, contracts), then a **link per payment**. The vendor's cobrador opens it, submits the invoice, and Clara (pagador) decides and negotiates corrections in that thread. Signed webhooks report every state change. Plan: `~/.claude/plans/frolicking-wondering-canyon.md`.

## T16: Vendor negotiation loop
- **Description:** `lib/engine/negotiate.ts` (pure): on a HOLD whose reasons are all negotiable (`CONTRACT_MISMATCH`, `CURRENCY_NOT_ALLOWED`, `DUPLICATE`, `DUE_TOO_FAR`, concept-only `LOW_CONFIDENCE`) Clara asks the vendor for a correction, max 2 rounds. Corrected invoices are built in code from structured fields, pass `validateCorrection` (same vendor, registered account, amount ≤ original and ≤ contract, allowed currency) and re-run the unchanged `decide()`. Outcomes: `auto_resolved | scheduled | closed | human`. `lib/engine/cobrador.ts`: the vendor-side agent, rule-driven (`data/cobradores.json`), with compromised configs for adversarial cases. Prose: templates always, Claude optional (`vendor-prose.ts`), fed only `ProseFacts` (no limits).
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** 0 unsafe payments before and after negotiation. Never negotiates bank changes, pressure, unknown vendors, limits, budget or past-due. 3 adversarial cobradores (new account, injection, raised amount) end in `human`. Outgoing messages never contain tolerance, budget, limits or thresholds.
- **Tests:** `negotiate.test.ts`: whitelist, `validateCorrection`, happy paths, round cap, adversarial, leak test, 500-case property test (`auto_resolved ⇔ PAY ∧ no failing rule ∧ guardrail ok`). Dataset eval reports a resolution rate.
- **Comments:** Done Oct 17. Eval: 21/21, 76% autonomy, 0 unsafe before and after negotiation, resolution 3/10 HOLDs. Budget not tuned (option A): #08 and #10 also hit `BUDGET_EXCEEDED`, so they go to a person. #14 (EUR) → reissue in USD → PAY; #07 → closed; #16 → scheduled; #19–21 (compromised cobradores) → human. Claude prose via `vendor-prose.ts` (haiku), templates as fallback.

## T17: Cases, store and webhooks
- **Description:** `Case {id, role: payer|collector, status, invoice, decision, thread, review, settlement, receipt}` in Supabase (`db/schema.sql`: `policies`, `cases`, `case_events` append-only; RLS on, server-only via service role) behind `CaseStore` with a `MemoryStore` for tests/dev. Routes: `POST/GET /api/cases`, `GET /api/cases/[id]` (`view=public`, `since`), `POST /api/cases/[id]/invoice|messages|review`, `GET/PUT /api/policy`, `/api/reset`, `/api/health`, `/api/keys`. Public page `/c/[id]` (upload, thread, reply actions, receipt). Dashboard reads from the server. Webhooks signed with `X-Clara-Signature` (HMAC-SHA256), sent via `after()`, logged as events. `MockExecutor` settlement ("would settle via Blinka rails"). `role: collector` returns 501 (roadmap).
- **Owner:** claude (code), cristobal (Supabase keys and `CLARA_SIGNING_KEY` in Vercel)
- **Status:** in-progress
- **Acceptance criteria:** A case link works end to end in a private window; a HOLD/`needs_human` case can never be approved from the UI; one payment per case; webhook HMAC verifies.
- **Tests:** `cases.test.ts` with `MemoryStore` (flow, 409 on second invoice, 403 approve on needs_human, stale update → 409, derived ledger, webhook HMAC).
- **Comments:** Oct 17: Supabase project `clara` created and `db/schema.sql` applied; store, service, routes and `/c/[id]` page done and smoke-tested on the memory store. Pending: `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`/Vercel (human), dashboard integration (`/app`), reconcile with `todo1.md` T5/T6 (Neon vs Supabase, `/api/invoices` vs `/api/cases`).

## T18: Trust primitives
- **Description:** `lib/engine/receipt.ts`: Ed25519-signed decision receipts carrying `policyHash` (sha256 of policy + beneficiaries + contracts), verifiable against `GET /api/keys`; replay is the proof (rules are pure). Registered-account check on corrections (T16 guardrail). No-leak test on outgoing prose. Roadmap in README: company-side cobrador link, x402 so any cobrador agent can call Clara, ZK/FHE for negotiating without revealing either side's limits.
- **Owner:** claude
- **Status:** in-progress
- **Acceptance criteria:** Tampered receipt fails verification; `policyHash` changes when a rule changes and is stable under key order.
- **Tests:** `receipt.test.ts`.
- **Comments:** Oct 17: receipts, `policyHash`, `GET /api/keys`, registered-account check and no-leak test done. README roadmap section pending.

## T19: Single workspace on the mockup shell
- **Description:** `/app` rebuilt as the mockup's sidebar shell (Panel, Facturas, Reglas, Aprobaciones, Reportes, Configuración), every section reading the server (`/api/cases`, `/api/policy`). Deleted the browser-store workspace (Bandeja, OrbitApp, localStorage) and `/app/casos`. Facturas opens cases by vendor + contract (optionally with the invoice already received); Aprobaciones is the human queue; Reportes computes the eval from the cases; Configuración holds agents, beneficiaries, contracts, webhook, API keys and the demo reset.
- **Owner:** claude
- **Status:** done
- **Acceptance criteria:** One story in the UI; a judge can run the demo from Panel → Facturas → Aprobaciones → Reportes without seeing two models. `npm run build` green.
- **Tests:** Existing suites; manual run of the demo set through the UI.
- **Comments:** Oct 17 evening. Supersedes todo1.md T4 and T7–T12.

## T20: Hire the agents with USDC (x402 + Privy)
- **Description:** `POST /api/agents/{pagador,cobrador}/activate` protected with `withX402` (`@x402/next`, facilitator `x402.org`, Base Sepolia USDC, `ORBIT_PAY_TO`). Login with Privy (`/login`, embedded wallet on Base Sepolia); `AgentsCard` in Configuración pays the 402 with the wallet (`@x402/fetch` + `@x402/evm`) and shows payer, tx and balance. Activations stored on the company (`Company.agents`), kept across demo resets. `ORBIT_ACTIVATION_FREE=1` activates without payment; `ORBIT_REQUIRE_ACTIVATION=1` blocks new cases until the pagador is active.
- **Owner:** claude (code), wmb/cristobal (`NEXT_PUBLIC_PRIVY_APP_ID`, `ORBIT_PAY_TO`, testnet USDC)
- **Status:** in-progress
- **Acceptance criteria:** From a fresh login, paying 0.10 USDC on Base Sepolia activates the pagador and the transaction is linked from Configuración.
- **Tests:** Build green; end-to-end payment verified by hand once the Privy app id and treasury address exist.
- **Comments:** Code complete; untested against the live facilitator until the env vars are set.

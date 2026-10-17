# Clara: AP agent with guardrails (todo)

**30X Hackathon, Blinka challenge** ("Agents that pay for the company"). Deadline **Sun Oct 18, 12:00 COT**. Uses **JEV (TypeSafe)** as the fast decision layer. (The PayBox Chapter 1 submission was cancelled on Oct 17.)

**Pitch:** Clara reads a company's invoices and decides, for each one, whether to **PAY**, **HOLD** or **ESCALATE** to a human, inside rules the company defines. It never approves a payment outside the rules without a human, and it explains every decision in plain language.

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
- **Comments:** Private repo https://github.com/DevCristobalvc/clara (make public before submitting). Commits as DevCristobalvc.

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
  - `POST /api/v1/check` (public JSON check, so other agents can call Clara as a guardrail, < 2 s)
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
- **Description:** Vercel project `clara`, with env vars `TYPESAFE_API_KEY` and AI Gateway configured.
- **Owner:** claude (CLI), cristobal (any secret entry)
- **Status:** in-progress
- **Acceptance criteria:** A public URL works end to end.
- **Tests:** Smoke test against prod.
- **Comments:** Live at https://clara-kohl.vercel.app. Pending env vars `TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY` in Vercel.

## T10: Demo video (30X)
- **Description:** A 2–3 min pitch + demo video. The board processes the dataset: clean invoices get paid; the duplicate, new beneficiary and contract mismatch are held; the over-limit one is escalated and a human approves it. Then the audit log explains each decision, and the eval shows 0 unsafe payments.
- **Owner:** claude (script + automated screen recording), cristobal (voice)
- **Status:** todo
- **Acceptance criteria:** Uploaded (YouTube/Loom) and linked in the README and HackRadar.
- **Tests:** n/a
- **Comments:**

## T13: JEV playbook (30X bonus)
- **Description:** `docs/jev-playbook.md`, at most 5 pages: the decisions JEV makes in Clara, the typed question schema, thresholds, when it hands off to a human or an LLM, who operates it, and how success is measured.
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

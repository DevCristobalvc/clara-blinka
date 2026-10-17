# ORBIT · plan (the only one)

**30X Hackathon · Blinka challenge** ("Agents that pay for the company"). Submission closes **Sun Oct 18, 12:00 COT**; Demo Day Oct 19–20. This file replaces `todo1.md` (merged Oct 17 evening). History in `CHANGELOG.md`; how the product works in `docs/how-it-works.md`; the pitch in `docs/pitch.md`.

**Product in one line:** ORBIT is where a company's AI agents collect and pay for it. The **pagador** reads each invoice, checks it against the rules the company set once, negotiates corrections with the vendor on a per-payment link, and pays, holds or escalates, with a signed receipt per decision. The company hires and funds its agents paying in USDC (x402). The **cobrador** is the same engine with the rules inverted (next version).

**Team:** cristobal (decisions, Vercel, keys, HackRadar, pitch voice) · wmb (product, Supabase/data layer, pitch, video) · claude sessions (code) · agy (illustration, MCP, docs). Work on branches, PR to `main`, `git pull --rebase` often, announce new dependencies.

**Safety invariant (never weakened):** hard limits live in code; JEV/Claude can only make a decision stricter; corrections only move toward the contract; `decide()` throws on PAY with a failing check; eval must stay at 0 unsafe payments before and after negotiation.

## Status

| # | Task | Owner | Status |
|---|---|---|---|
| T0 | Repo, scaffold, Vercel | claude | done |
| T1 | Demo dataset: Andes Labs Inc., 21 invoices (6 clean, 12 traps, 3 negotiation traps), `expected.json` | claude | done |
| T2 | Deterministic rules engine | claude | done |
| T3 | JEV judgments + offline fallback; live eval (`docs/eval-live.md`) | claude | done |
| T4 | Invoice extraction (Claude structured output, PDF/image/email/chat) | claude | done |
| T5 | Decision + explanation + safety invariant | claude | done |
| T6 | Eval harness (`npm run eval`): accuracy, autonomy, safety before/after negotiation, resolution | claude | done |
| T7 | Rebrand to ORBIT, landing `/`, mock login, `/app` | claude (30x1) | done |
| T8 | Vendor negotiation loop + simulated vendors + guardrails | claude | done |
| T9 | Cases on Supabase, public link `/c/[id]`, API, signed webhooks | claude | done |
| T10 | Signed receipts + `policyHash` + `/api/keys` | claude | done |
| T11 | Single workspace on the mockup shell (Panel, Facturas, Reglas, Aprobaciones, Reportes, Configuración) | claude | done |
| T12 | Hire the agents with USDC over x402 (activate → ORBIT treasury; fund → agent wallet), Privy login | claude | **in-progress** (code done; live payment unverified) |
| T13 | Deploy with env vars on Vercel (`orbit` project) | cristobal | **todo** |
| T14 | Demo video (`scripts/record-demo.mjs` + ElevenLabs narration from `docs/pitch.md`) + activation clip by hand | wmb, claude | **in-progress** |
| T15 | HackRadar: team, project form, links; submit before Sun 12:00 COT | cristobal (confirms), claude (text) | **todo** |
| T16 | Hero illustration on the landing | agy | in-progress |
| T17 | JEV playbook (30X bonus, `docs/jev-playbook.md`) | agy (draft), claude (review) | todo · P2 |
| T18 | MCP server (`/api/mcp`: `review_invoice`, `check_category_budget`, `request_human_approval`) | agy | todo · P2 |
| T19 | Inbound email ingestion (invoice arrives by email → case) | — | todo · P2 |
| T20 | Cobrador screens: collection cases with the rules inverted (`Case.role: collector`) | — | todo · next version |

Dropped: extraction with OpenAI (the Anthropic key works), Neon (Supabase chosen), x402 per case / ERC-8004 / wallets that move vendor money (out of the brief), dataset renamed to the mockup's vendors.

## Open tasks (detail)

### T12: Hire the agents with USDC (x402 + Privy)
- **Description:** `POST /api/agents/{pagador,cobrador}/activate` (fee → `ORBIT_PAY_TO`) and `/fund` (→ the agent's per-company wallet, derived from the server secret) protected with `withX402` (`@x402/next`, facilitator `x402.org`, USDC on Base Sepolia). Privy login (`/login`) gives the company an embedded wallet; `AgentsCard` in Configuración pays the 402 with it and shows wallet, balance, payer and tx. `scripts/x402-pay.mjs` pays with a plain test wallet to verify the server path.
- **Acceptance criteria:** From a fresh Privy login, paying 0.10 USDC activates the pagador and 1 USDC lands in its wallet; both show in Configuración with the BaseScan tx. The script succeeds against the local server.
- **Tests:** Build green. Manual: fund the test payer and the Privy wallet at https://faucet.circle.com (Base Sepolia), run `node --env-file=.env.local scripts/x402-pay.mjs activate pagador`, then the UI.
- **Comments:** Env vars in `.env.local`: `NEXT_PUBLIC_PRIVY_APP_ID`, `ORBIT_PAY_TO` (treasury), `ORBIT_TREASURY_PRIVATE_KEY` (sweep only), `ORBIT_TEST_PAYER_PRIVATE_KEY`. Fallback for the video: `ORBIT_ACTIVATION_FREE=1`.

### T13: Deploy
- **Description:** Merge PR #1 (`wmb/orbit-v2`) to `main`. In Vercel project `orbit` set: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLARA_SIGNING_KEY` (`node scripts/gen-signing-key.mjs`), `NEXT_PUBLIC_PRIVY_APP_ID`, `ORBIT_PAY_TO`; optionally `ORBIT_ACTIVATION_FREE=1`. Add `orbit.devcristobalvc.com` and `*.vercel.app` to the Privy app's allowed domains.
- **Acceptance criteria:** `/api/health` on prod reports `store: supabase`, extraction and JEV true; a case link works from another device; `/api/extract` no longer 503.
- **Tests:** Smoke on prod: run the demo set, open a vendor link, approve one escalation.

### T14: Demo video
- **Description:** `scripts/record-demo.mjs` records the core flow (landing → Reglas → Configuración → Nuevo caso → vendor link → demo set → Lucía's thread → vendor view → Aprobaciones → Reportes → Panel) as `docs/demo/orbit-demo.webm`. The activation/funding clip is screen-recorded by hand (Privy OTP + wallet signature). Narration from `docs/pitch.md` with ElevenLabs; edit in CapCut/iMovie; upload (YouTube/Loom); link in README and HackRadar.
- **Acceptance criteria:** 2–3 minutes, shows the three criteria (autonomy, safety, explainability) and the activation payment.

### T15: HackRadar submission
- **Description:** Create the team, fill in name, challenge (Blinka), description and links (repo, demo, video). Text ready in `docs/pitch.md`. Cristobal confirms before submit.
- **Acceptance criteria:** HackRadar shows the project as submitted before Sun 12:00 COT.

### T16–T20
See the table. T17/T18 are bonus; T19/T20 are the roadmap after the hackathon (also in README).

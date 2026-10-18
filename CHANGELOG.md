# Changelog

All notable changes to ORBIT. Dates in COT (UTC-5). The hackathon window is Oct 16–18, 2026.

## [Unreleased]

### Added
- **Vendor payouts on-chain, gas sponsored by Privy** (`lib/server/payout.ts`, `lib/server/privy.ts`): with `ORBIT_PAYOUTS=onchain` the pagador pays each approved invoice from its wallet in testnet USDC on Base Sepolia (1 USDC = 1,000 USD of invoice). The agent wallet signs an EIP-3009 authorization and a Privy server wallet per company (the relayer) submits it with `sponsor: true`, so no wallet needs ETH. Settlements carry the tx hash; the board shows the BaseScan link and the vendor page "Pago enviado … a través de Blinka". Requires `PRIVY_SECRET` and Fee sponsorship with Base Sepolia enabled in the Privy dashboard.
- **Depositar** modal in the account bar: QR (`ethereum:<wallet>@84532`), copy address, faucet link.
- Top bar shows the real signed-in Privy user; logout ends the Privy session and the workspace cookie.

### Ops
- Second deployment on the Ekinoxis Vercel team from the mirror repo `Ekinoxis-evm/orbit` (`main` = `wmb/orbit-v2`): https://orbit.ekinoxis.xyz (custom domain by wmb; also orbit-ekinoxis-team.vercel.app), public, same Supabase project and env as local (`.env.vercel`, gitignored, holds the nine production variables).
- One local env file: `.env.local` (scripts load it with `--env-file=.env.local`).
- Vercel project `orbit` connected to GitHub: every push to `main` deploys to production (orbit.devcristobalvc.com); PR branches get preview URLs. `ORBIT_SIGNING_KEY` set in Vercel.

### Docs
- **Final video v2** `docs/demo/orbit-demo-voz.mp4` (3:33): problem → team → what we built → live sign-in with Privy → account bar and Depositar QR → hiring and funding paid from the company wallet with confirmations → rules → the board filling with on-chain payouts (narration explains rules in code + JEV typed judgments) → Lucía's negotiation and the vendor's page with the payout → approvals → reports → results. Review frames in `docs/demo/frames/`.
- Video v2 pipeline: `docs/pitch.md` trimmed to ≈3:00 with a caption line per block; `scripts/record-demo.mjs` records 1080p with zoom marks and a click pulse; `scripts/narrate.mjs` time-lapses the board, applies the zooms, captions and fades.
- README rewritten as a short hook: punchline, a Mermaid diagram of how ORBIT works, results, how to try it. The detail moved to `docs/architecture.md`, `docs/api.md`, `docs/setup.md` and `docs/dataset.md`.

- Upload the demo video (`docs/demo/orbit-demo-voz.mp4`, 3:27) and link it; HackRadar submission.
- Cobrador screens (collection cases with the rules inverted).

## 0.3.0 · 2026-10-17 (evening) · "Agents that collect and pay"

### Added
- **Vendor negotiation loop** (`lib/engine/negotiate.ts`): on a HOLD for negotiable reasons ORBIT asks the vendor for one correction (reissue at the contract amount, reissue in an allowed currency, confirm an already-paid duplicate, accept a payment date, clarify the concept), max 2 rounds. Corrections are built in code, validated (`validateCorrection`: same vendor, registered account, amount ≤ original and ≤ contract, allowed currency) and re-run through the unchanged `decide()`. Outcomes: `auto_resolved`, `scheduled`, `closed`, `human`.
- **Simulated vendors** (`lib/engine/cobrador.ts`, `data/cobradores.json`): rule-driven replies per vendor; three invoices with compromised vendors (new account, injected instruction, raised amount).
- **Signed receipts** (`lib/engine/receipt.ts`): Ed25519, with `policyHash`; public key at `GET /api/keys`.
- **Cases** on Supabase (`db/schema.sql`: `policies`, `cases`, `case_events`; RLS on, server only) with an in-memory store for tests and dev. One payment = one public link `/c/<id>` (invoice upload, conversation, corrections, receipt).
- **API**: `/api/cases`, `/api/cases/[id]` (`?view=public`, `?since=`), `/api/cases/[id]/{invoice,messages,review}`, `/api/policy`, `/api/reset`, `/api/health`, `/api/keys`. HMAC-signed webhooks (`X-Orbit-Signature`) on every status change.
- **Workspace rebuilt on the mockup shell**: Panel, Facturas (open a case by vendor + contract, upload, run the demo set), Reglas (saved to the server), Aprobaciones (only escalations can be approved), Reportes (eval from the cases, CSV/JSON export), Configuración.
- **Hire the agents with USDC over x402**: `POST /api/agents/{pagador,cobrador}/activate` (fee to ORBIT's treasury) and `/fund` (into the agent's own per-company wallet), protected with `withX402` on Base Sepolia; Privy login gives the company an embedded wallet that pays the 402. `ORBIT_ACTIVATION_FREE=1` for previews without a wallet.
- Claude writes the negotiation messages (`lib/engine/vendor-prose.ts`, templates as fallback).
- **Panel as the flow**: a Blinka-style account bar (company, wallet, USDC balance, Depositar / Enviar, invoices to pay) and a one-step-at-a-time setup wizard: contract the pagador (pay), load its funds (pay), its rules, put it to work; every payment shows its BaseScan confirmation.
- **Vendor invites**: opening a case sends the link to the vendor (Resend email when `RESEND_API_KEY` is set, recorded otherwise) and the case shows who received it. Cards show the live conversation while a case is negotiating; the vendor's page ends with a payment summary (original → corrected, rounds, registry reference).
- Live x402 payments verified on Base Sepolia (activate 0.10 USDC, fund 1.00 USDC); settlement tx hashes attached to the activation (`POST /api/agents/:kind/tx`) and linked from Configuración. Malformed case ids return 404.
- **Pitch deck** at `/deck` (title, problem, team, what we built, results, next) and the **demo video** `docs/demo/orbit-demo-voz.mp4` (3:27): `scripts/record-demo.mjs` records the flow with the real x402 payments on camera and writes a timeline; `scripts/narrate.mjs` generates the ElevenLabs narration from `docs/pitch.md` and syncs it. Also `scripts/x402-pay.mjs`, `scripts/gen-signing-key.mjs`.

### Changed
- Eval now reports safety **before and after negotiation** and a resolution rate: 21/21, 0 · 0 unsafe, 76% autonomy, 3/10 resolved.
- Payments are **recorded** (`LedgerExecutor`, `pago-…` reference), never executed; no "rails" wording in the UI.
- One plan: `todo.md` absorbs `todo1.md`.

### Removed
- The browser-store workspace (`OrbitApp`, `Inbox`, `Board`, `Panels`, `DecisionDetail`, localStorage) and `/app/casos`.
- `@upstash/redis` (unused).

## 0.2.0 · 2026-10-17 (afternoon) · ORBIT

- Rebrand Clara → **ORBIT** from the mockup (`docs/design/orbit-mockup.png`): palette, logo, typography, copy.
- Landing page at `/`, mock login at `/login` (123/123), workspace moved to `/app`.
- Domain `orbit.devcristobalvc.com`, repo renamed to `DevCristobalvc/orbit`.

## 0.1.0 · 2026-10-16/17 · Clara prototype

- Rules engine, JEV judgments (with offline fallback), Claude extraction, `decide()` with the safety invariant and a randomized test.
- Fictitious company Andes Labs Inc., 18 invoices (6 clean, 12 traps), eval harness (`npm run eval` → `docs/eval.md`).
- Tabbed UI with state in localStorage, stateless `POST /api/decide`, deployed on Vercel.

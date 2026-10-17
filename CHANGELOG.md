# Changelog

All notable changes to ORBIT. Dates in COT (UTC-5). The hackathon window is Oct 16–18, 2026.

## [Unreleased]

- Demo video and pitch (`docs/pitch.md`), HackRadar submission.
- Live verification of the x402 payments with a funded wallet.
- Cobrador screens (collection cases with the rules inverted).

## 0.3.0 · 2026-10-17 (evening) · "Agents that collect and pay"

### Added
- **Vendor negotiation loop** (`lib/engine/negotiate.ts`): on a HOLD for negotiable reasons ORBIT asks the vendor for one correction (reissue at the contract amount, reissue in an allowed currency, confirm an already-paid duplicate, accept a payment date, clarify the concept), max 2 rounds. Corrections are built in code, validated (`validateCorrection`: same vendor, registered account, amount ≤ original and ≤ contract, allowed currency) and re-run through the unchanged `decide()`. Outcomes: `auto_resolved`, `scheduled`, `closed`, `human`.
- **Simulated vendors** (`lib/engine/cobrador.ts`, `data/cobradores.json`): rule-driven replies per vendor; three invoices with compromised vendors (new account, injected instruction, raised amount).
- **Signed receipts** (`lib/engine/receipt.ts`): Ed25519, with `policyHash`; public key at `GET /api/keys`.
- **Cases** on Supabase (`db/schema.sql`: `policies`, `cases`, `case_events`; RLS on, server only) with an in-memory store for tests and dev. One payment = one public link `/c/<id>` (invoice upload, conversation, corrections, receipt).
- **API**: `/api/cases`, `/api/cases/[id]` (`?view=public`, `?since=`), `/api/cases/[id]/{invoice,messages,review}`, `/api/policy`, `/api/reset`, `/api/health`, `/api/keys`. HMAC-signed webhooks (`X-Clara-Signature`) on every status change.
- **Workspace rebuilt on the mockup shell**: Panel, Facturas (open a case by vendor + contract, upload, run the demo set), Reglas (saved to the server), Aprobaciones (only escalations can be approved), Reportes (eval from the cases, CSV/JSON export), Configuración.
- **Hire the agents with USDC over x402**: `POST /api/agents/{pagador,cobrador}/activate` (fee to ORBIT's treasury) and `/fund` (into the agent's own per-company wallet), protected with `withX402` on Base Sepolia; Privy login gives the company an embedded wallet that pays the 402. `ORBIT_ACTIVATION_FREE=1` for previews without a wallet.
- Claude writes the negotiation messages (`lib/engine/vendor-prose.ts`, templates as fallback).
- `docs/pitch.md`, `scripts/record-demo.mjs`, `scripts/x402-pay.mjs`, `scripts/gen-signing-key.mjs`.

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

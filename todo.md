# ORBIT · plan (the only one)

**30X Hackathon · Blinka challenge** ("Agents that pay for the company"). Submission closes **Sun Oct 18, 12:00 COT**; Demo Day Oct 19–20. This file replaces `todo1.md` (merged Oct 17 evening). History in `CHANGELOG.md`; the pitch in `docs/pitch.md`.

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
| T12 | Hire the agents with USDC over x402 (activate → ORBIT treasury; fund → agent wallet), Privy login | claude | done (live payments verified Oct 17 20:47 COT) |
| T13 | Deploy with env vars on Vercel (`orbit` project) | cristobal | **todo** |
| T14 | Demo video: `docs/demo/orbit-demo-voz.mp4` (3:27): deck + account bar + setup wizard with the real x402 payments on camera + board, negotiation, approvals, results + ElevenLabs narration synced by timeline (board segment at 3×). Pending: upload and link | wmb | **done (upload pending)** |
| T15 | HackRadar: team, project form, links; submit before Sun 12:00 COT | cristobal (confirms), claude (text) | **todo** |
| T16 | Hero illustration on the landing | agy | in-progress |
| T17 | JEV playbook (30X bonus, `docs/jev-playbook.md`) | agy (draft), claude (review) | todo · P2 |
| T18 | MCP server (`/api/mcp`: `review_invoice`, `check_category_budget`, `request_human_approval`) | agy | todo · P2 |
| T19 | Inbound email ingestion (invoice arrives by email → case) | — | todo · P2 |
| T20 | Cobrador screens: collection cases with the rules inverted (`Case.role: collector`) | — | todo · next version |
| T21 | README as a short hook (punchline + Mermaid diagram); architecture, API, setup and dataset moved to `docs/` | claude | done |
| T22 | Vendor payouts on-chain from the agent wallet, gas sponsored by Privy (EIP-3009 + Privy relayer wallet) | claude | done (live Oct 17 19:52 COT) |
| T23 | Final video v2 (`docs/demo/orbit-demo-voz.mp4`, 3:33): live Privy sign-in, real x402 payments from wmb's wallet, on-chain payouts, JEV explained, zooms, captions, no silent gaps | claude | done (Oct 18 13:10 COT) |
| T24 | Mirror repo `Ekinoxis-evm/orbit` and public deployment on the Ekinoxis Vercel team at https://orbit.ekinoxis.xyz | claude | done (Oct 18 11:20 COT; domain by wmb 12:10) |

Dropped: extraction with OpenAI (the Anthropic key works), Neon (Supabase chosen), x402 per case / ERC-8004 / wallets that move vendor money (out of the brief), dataset renamed to the mockup's vendors.

## Open tasks (detail)

### T12: Hire the agents with USDC (x402 + Privy)
- **Description:** `POST /api/agents/{pagador,cobrador}/activate` (fee → `ORBIT_PAY_TO`) and `/fund` (→ the agent's per-company wallet, derived from the server secret) protected with `withX402` (`@x402/next`, facilitator `x402.org`, USDC on Base Sepolia). Privy login (`/login`) gives the company an embedded wallet; `AgentsCard` in Configuración pays the 402 with it and shows wallet, balance, payer and tx. `scripts/x402-pay.mjs` pays with a plain test wallet to verify the server path.
- **Acceptance criteria:** From a fresh Privy login, paying 0.10 USDC activates the pagador and 1 USDC lands in its wallet; both show in Configuración with the BaseScan tx. The script succeeds against the local server.
- **Tests:** Build green. Manual: fund the test payer and the Privy wallet at https://faucet.circle.com (Base Sepolia), run `node --env-file=.env.local scripts/x402-pay.mjs activate pagador`, then the UI.
- **Comments:** Verified live Oct 17 20:47 COT with `scripts/x402-pay.mjs`: activate 0.10 USDC (tx 0x28c7fb74…9059) and fund 1.00 USDC (tx 0x0ab9fa56…cacc) settled on Base Sepolia; treasury and agent wallet balances match. The UI path (Privy wallet) uses the same client code; tx hashes are attached via `POST /api/agents/:kind/tx`. Env vars in `.env.local`: `NEXT_PUBLIC_PRIVY_APP_ID`, `ORBIT_PAY_TO` (treasury), `ORBIT_TREASURY_PRIVATE_KEY` (sweep only), `ORBIT_TEST_PAYER_PRIVATE_KEY`. Fallback for the video: `ORBIT_ACTIVATION_FREE=1`.

### T13: Deploy
- **Description:** Merge PR #1 (`wmb/orbit-v2`) to `main`. In Vercel project `orbit` set: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ORBIT_SIGNING_KEY` (`node scripts/gen-signing-key.mjs`), `NEXT_PUBLIC_PRIVY_APP_ID`, `ORBIT_PAY_TO`; optionally `ORBIT_ACTIVATION_FREE=1`. Add `orbit.devcristobalvc.com` and `*.vercel.app` to the Privy app's allowed domains.
- **Acceptance criteria:** `/api/health` on prod reports `store: supabase`, extraction and JEV true; a case link works from another device; `/api/extract` no longer 503.
- **Tests:** Smoke on prod: run the demo set, open a vendor link, approve one escalation.

### T14: Demo video
- **Description:** `scripts/record-demo.mjs` records the pitch in order (deck: problem, team, what we built → login → Panel with the invoices to pay → real x402 activation and funding on camera → rules → put it to work → board → Lucía's thread → vendor view → approvals → reports → results and next) and writes a timeline; `scripts/narrate.mjs` generates the ElevenLabs narration (voice William) from `docs/pitch.md` and places each block on that timeline. Output: `docs/demo/orbit-demo-voz.mp4` (3:27). Upload (YouTube/Loom) and link in README and HackRadar.
- **Acceptance criteria:** 2–3 minutes, shows the three criteria (autonomy, safety, explainability) and the activation payment.

### T15: HackRadar submission
- **Description:** Create the team, fill in name, challenge (Blinka), description and links (repo, demo, video). Text ready in `docs/pitch.md`. Cristobal confirms before submit.
- **Acceptance criteria:** HackRadar shows the project as submitted before Sun 12:00 COT.

### T16–T20
See the table. T17/T18 are bonus; T19/T20 are the roadmap after the hackathon (also in README).

### T22: Vendor payouts on-chain, gas sponsored by Privy
- **Description:** `WalletExecutor` (`ORBIT_PAYOUTS=onchain`) pays approved invoices from the agent's wallet in testnet USDC on Base Sepolia, `ORBIT_PAYOUT_SCALE=1000` (1 USDC = 1,000 USD). The agent wallet holds only USDC: it signs an EIP-3009 `transferWithAuthorization` and a Privy server wallet per company (`lib/server/privy.ts`, `external_id` `orbit-relayer-<company>`, created on first use) submits it with `sponsor: true`. No wallet needs ETH. Errors leave the settlement `pending` with the reason.
- **Acceptance criteria:** A PAY case ends with `settlement.status = "sent"` and a BaseScan tx; the vendor wallet receives the USDC; the agent wallet has 0 ETH throughout. The vendor page says "Pago enviado … a través de Blinka".
- **Tests:** `npm test` green (56). Live smoke: `npx tsx --tsconfig tsconfig.json --env-file=.env.local <script>` running `WalletExecutor.execute` once for 10 USD (0.01 USDC).
- **Comments:** Oct 17 19:52 COT, after Base Sepolia was enabled in Privy Fee sponsorship: smoke 0.01 USDC sent (tx 0x1cad02b7…1760, 16 s) and a full case for invoice 01 (Valentina Ríos) ended `paid` with settlement `sent`, 2.3 USDC, tx 0x0836acb1…74e6, 0 ETH in every wallet. Earlier that evening: relayer wallet `0xeBa3CB2a4113567bB47447Fe17B995269F3837bC` created for `andes`; Privy answered `Gas sponsorship is not configured for chain eip155:84532`. Pending on the Privy dashboard: Fee sponsorship → Supported chains → Base Sepolia. Agent wallet `0x309ceaC4DD5fdCCEA810c352b44bF92F3902C7CC` holds 207 USDC.

### T23: Final video v2
- **Description:** Re-record the pitch + demo with the current product (account bar, Depositar QR, wizard with real x402 payments, board, Lucía negotiation, vendor page with on-chain payout and BaseScan link, Aprobaciones, Reportes). Script trimmed to ≈2:45 in `docs/pitch.md`. Recording at 1440×900 @2× into 1920×1080 with smooth zoom-ins on the key moments, larger cursor with click pulse, board segment time-lapsed. Editing in `scripts/narrate.mjs`: Spanish lower-third captions (one claim per block), fades between scenes, optional low music bed (ElevenLabs). Deck slides (`components/Deck.tsx`) redone with big type and one visual each. Live sign-in by William on camera.
- **Acceptance criteria:** Under 3:00; every on-screen text readable at 1080p; no silent gap over 2 s; the payment confirmations, a BaseScan hash and the vendor's corrected invoice are visible and zoomed; narration in sync with the screen; opens with the problem, then team with LinkedIn, then what we built, then the demo, then results.
- **Tests:** Contact sheet every 5 s reviewed; `ffprobe` duration; audio waveform check for gaps.
- **Comments:** Current video (3:27) reviewed Oct 17 night: UI too small to read, 27 s static problem slide, no zooms or captions, shows "(ficticia)" and recorded-only payments.

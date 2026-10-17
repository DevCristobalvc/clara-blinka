# Setup

Back to the [README](../README.md).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000 (predev syncs data/invoices -> public/)
npm test             # engine, negotiation, receipts, case service, dataset eval
npm run eval         # dataset eval only, rewrites docs/eval.md
npm run lint && npm run build
ORBIT_EVAL_LIVE=1 npm run eval   # eval against live JEV (needs TYPESAFE_API_KEY)
```

## Environment

Copy [`.env.example`](../.env.example) to `.env.local`. Every value is optional; each missing one falls back to a labeled demo mode. Secrets go only in `.env.local` and Vercel, never in git.

| Variable | Purpose | Without it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Extraction of uploaded PDFs/images/emails, and the wording of negotiation messages | Uploads disabled, template wording |
| `TYPESAFE_API_KEY` | Live JEV judgments | Offline heuristics (labeled) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Case store. The key is server-only, never `NEXT_PUBLIC_` | In-memory store, cases don't persist |
| `ORBIT_SIGNING_KEY` | Receipt signing key (`node scripts/gen-signing-key.mjs`) | Ephemeral key per process |
| `ORBIT_ADMIN_TOKEN` | Required as `X-Orbit-Admin` on `PUT /api/policy` | Policy editable without a token |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy login and the company's embedded wallet | Demo login `123` / `123` only |
| `PRIVY_SECRET` (or `PRIVY_APP_SECRET`) | Privy server wallets: one relayer per company submits the agent's vendor payouts with gas sponsorship. In the Privy dashboard turn on **Fee sponsorship** and add **Base Sepolia** under Supported chains | Payouts try a direct transfer, which needs ETH in the agent wallet |
| `ORBIT_PAYOUTS=onchain` | Pay approved invoices from the agent wallet in testnet USDC (`ORBIT_PAYOUT_SCALE`, default 1000: 1 USDC = 1,000 USD) | Payments are recorded in the ledger only |
| `ORBIT_WALLET_SEED` | Secret the per-company agent wallets are derived from (falls back to `ORBIT_SIGNING_KEY`) | Random per process: the deposit address changes on restart |
| `RESEND_API_KEY` | Email the case link to the vendor | Invite recorded on the case, not sent |
| `ORBIT_PAY_TO` | ORBIT's treasury on Base Sepolia (activation USDC lands here) | Placeholder address, demo only |
| `ORBIT_ACTIVATION_FREE=1` | Activate agents without paying (previews without a wallet) | x402 payment required |
| `ORBIT_REQUIRE_ACTIVATION=1` | Refuse to open cases until the pagador is active | Cases open without activation |
| `NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL` | Optional RPC for USDC balance reads | Default public Base Sepolia RPC |

- **Testnet USDC:** https://faucet.circle.com (Base Sepolia).
- **x402 facilitator:** `https://x402.org/facilitator`.

## Database

`db/schema.sql` creates `policies`, `cases` and `case_events` (an append-only audit log), with RLS on and no policies. The tables are only accessed from API routes, using the service-role key.

## Deploy

The Vercel project is `orbit` (team `devcristobalvc`) on `orbit.devcristobalvc.com`, connected to GitHub: **every push to `main` deploys to production**, and every PR gets a preview URL. Set the variables above in Vercel for Production and Preview. Add the production domain and `*.vercel.app` to the Privy app's allowed origins.

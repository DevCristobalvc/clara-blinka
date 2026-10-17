@AGENTS.md

# ORBIT (formerly Clara): AI agents that collect and pay for your company (30X Hackathon)

ORBIT's **pagador** agent reads invoices (PDF, image, email, chat), decides **PAY / HOLD / ESCALATE** inside company-defined rules, **negotiates corrections with the vendor's cobrador** on a shareable case link, and explains every decision. Built for the 30X Hackathon Blinka challenge, with JEV (TypeSafe) as the fast judgment layer.

- **Deadline:** Sun Oct 18 2026, 12:00 COT. Demo Day Oct 19–20.
- **Read first:** `docs/how-it-works.md` (the service end to end, what is real vs simulated). **Plan:** `todo.md`, the only one (`todo1.md` was merged into it). **History:** `CHANGELOG.md`: add an entry for every user-visible change. **Context:** `contexto30x.md` (briefs, URLs). **Pitch:** `docs/pitch.md`.
- **Prod:** https://orbit.devcristobalvc.com (Vercel project `clara`, team `devcristobalvc`). Landing `/`, mock login `/login` (123/123), workspace `/app`, public case link `/c/<id>`.

## Non-negotiables

1. **Safety invariant.** Hard limits live in deterministic code (`lib/engine/rules.ts`). JEV only answers fuzzy questions and can make a decision *stricter, never looser*. `decide()` throws on a PAY with any failing check. Approving an improper payment disqualifies us.
2. **Negotiation can only add facts.** Vendor text never reaches a rule: corrected invoices are built in code from structured fields, pass `validateCorrection` (same vendor, registered account, amount ≤ original and ≤ contract) and re-run the unchanged `decide()`. Only `NEGOTIABLE_CODES` are negotiated; bank changes, pressure, budget, limits, unknown vendors and past-due go to a person. Max 2 rounds. The prose layer only sees `ProseFacts` (no limits).
3. **No arithmetic, dates or counting in an LLM/JEV.** That belongs in `rules.ts` / `fx.ts` / `negotiate.ts`.
4. **The eval must stay at 0 unsafe payments, before and after negotiation.** Run `npm test` after any engine, dataset or cobrador change.
5. **No secrets in the repo.** Keys go in `.env.local` and Vercel only: `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `CLARA_SIGNING_KEY` (receipts), `CLARA_ADMIN_TOKEN` (optional), `NEXT_PUBLIC_PRIVY_APP_ID` (login + company wallet), `ORBIT_PAY_TO` (x402 treasury on Base Sepolia), `ORBIT_ACTIVATION_FREE` / `ORBIT_REQUIRE_ACTIVATION` (optional switches).
6. **Payments are recorded, never executed.** `LedgerExecutor` writes a ledger reference; "rails" wording stays out of the UI. The only on-chain movement is the agent activation over x402 (testnet USDC).

## Commands

```bash
npm run dev     # http://localhost:3000 (predev syncs data/invoices -> public/)
npm test        # engine + negotiation + receipt + case-service tests, plus the dataset eval (offline, deterministic)
npm run eval    # dataset eval only, rewrites docs/eval.md
npm run lint && npm run build
ORBIT_EVAL_LIVE=1 npm run eval   # eval against live JEV (needs TYPESAFE_API_KEY)
ORBIT_PROSE=template npm run dev # force template prose even with an Anthropic key
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/render-invoices.mjs   # re-render data/invoices/*
```

## Layout

- `lib/engine/` (pure, offline-testable): `types` → `extract` (Claude structured output) → `rules` → `jev` → `decide` → `explain`; `negotiate` (loop, guardrails, templates), `cobrador` (rule-driven vendor agent), `receipt` (Ed25519 receipts + `policyHash`), `executor` (`MockExecutor`), `ledger` (`ledgerFor`, `effectiveDecision`), `labels`, `fx`, `severity`, `thresholds`. `vendor-prose` is server-only (Claude writes the words).
- `lib/server/`: `store` (`CaseStore`: `SupabaseStore` + `MemoryStore`), `cases` (service: create → submit → negotiate → review, `publicCase`), `webhooks` (signed `X-Clara-Signature`), `http` (route helpers, `notify` via `after()`), `seed`.
- `app/api/`: `cases`, `cases/[id]`, `cases/[id]/{invoice,messages,review}`, `policy`, `reset`, `health`, `keys`, plus the stateless `decide` and `extract`. `app/c/[id]`: public case page (`components/CasePage.tsx`).
- `db/schema.sql`: `policies`, `cases`, `case_events` (append-only audit). Applied to Supabase project `clara` (org Ekinoxis labs). RLS on, no policies: server-only.
- `components/app/`: the workspace (`Shell` sidebar/topbar, `Workspace` server-backed context, `PanelView`, `FacturasView`, `ReglasView`, `AprobacionesView`, `ReportesView`, `ConfiguracionView`, `AgentsCard` (x402 activation), `CaseDetail`). `components/CasePage.tsx` is the vendor's public page; `RulesEditor` the rules form; `landing/`, `brand/`, `PrivyLogin`. State never lives in the browser: everything reads `/api/*`. Theme tokens in `app/globals.css` (`ink`, `panel`, `panel-2`, `line`, `orbit`).
- `lib/server/agents.ts` + `activate-route.ts`: agent plans, `withX402`-protected activation (`app/api/agents/*`). `lib/client/x402.ts`: Privy wallet → x402 paid fetch.
- `data/`: fictitious "Andes Labs Inc.", 21 invoices (6 clean, 12 traps, 3 adversarial cobradores), `expected.json` (actions + `expectedResolution`), `cobradores.json` (per-file compromised configs).

## Conventions

- **Language:** code, repo docs, commits and PRs in **English**. UI strings, decision explanations and vendor messages in **Spanish** (English for US vendors, by beneficiary country). Chat with the team following the user.
- **Plan first:** agree on the plan, write it to `todo.md` (title, description, status, acceptance criteria, tests, comments), get an explicit "go", then build. Keep answers short.
- Next.js 16 with `cacheComponents`: read `node_modules/next/dist/docs/` before touching routing, caching or config. Route handlers send `Cache-Control: no-store`; `params` is a Promise.
- **Commits:** the repo owner commits as `DevCristobalvc` and without `Co-Authored-By` trailers (see `contexto30x.md` §10). Confirm identity with the user before committing.

## Skills to load

Project skills (`.claude/skills/`): `clara-engine` (pipeline, negotiation, recipes), `hackathon-30x` (criteria, submission checklist).

User/plugin skills: `typesafe:typesafe-ai` (JEV), `claude-api` / `ekx-anthropic-sdk` (extraction, prose), `vercel:nextjs`, `vercel:next-cache-components`, `ekx-nextjs-app`, `supabase:supabase` + `supabase:supabase-postgres-best-practices` (store, schema), `frontend-design` (UI polish), `ekx-vercel-deploy`, `vercel:env`, `vercel:deploy`.

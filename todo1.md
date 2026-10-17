# ORBIT: autonomous AP agent, plan v1 (todo1)

> Supersedes the first prototype plan in `todo.md`. Status: **execution started**. Go given Oct 17 13:40 for the rebranding (T20); other tasks wait for T0.
> Deadline: **Sun Oct 18, 12:00 COT** (30X Hackathon, Blinka challenge). Created Sat Oct 17, 13:35 COT.

## Product in one line

**ORBIT** is a platform where a company's AI agent receives invoices on its own (email, PDF, chat, API/MCP), checks them against the company's rules, and **pays, holds or escalates** each one. It explains every decision, follows up with vendors when something is wrong, and never approves anything outside the rules without a human.

Tagline (from the mockup): **"Actúa con autonomía. Nunca sin límites."**

## Design source of truth

- Mockup: `docs/design/orbit-mockup.png`. **Follow it exactly**: layout, copy, colors, spacing, iconography.
- UI copy in Spanish, exactly as written in the mockup. Code, repo and docs in English.

## Decisions (proposed by Claude, pending Cristobal/wmb confirmation)

| # | Decision | Proposed | Status |
|---|---|---|---|
| D1 | Challenge | Blinka, with JEV inside as the judgment layer | proposed |
| D2 | Concept | Control tower + autonomous ingestion + vendor follow-up loop + MCP server | proposed |
| D3 | Agent language | TypeScript (reuse the tested engine, one codebase) | proposed |
| D4 | Extraction LLM | OpenAI (credits available; reads PDF and images). DeepSeek is text-only. No Anthropic key | proposed |
| D5 | Inbound email | Provider with an inbound webhook (pick in T14) | open |
| D6 | Hosting | Vercel (app, API, agent endpoints) + Neon Postgres (via the Vercel integration). Neon Functions only if a >5 min agent loop appears | proposed |
| D7 | Brand / domain | Rebrand ORBIT → **ORBIT**. Keep `orbit.devcristobalvc.com`. Repo name stays `orbit` unless renamed | proposed |
| D8 | Auth | Mock login at `/login` (user `123`, password `123`); cookie gate on `/app` via `proxy.ts`. Not real auth | confirmed (Oct 17) |
| D9 | Out of scope | x402, ERC-8004, real money movement, identity verification (excluded by the Blinka brief) | proposed |

## Architecture

```
 Inputs                         ORBIT agent backend (Vercel, Next.js route handlers)        Outputs
 Inbound email webhook ─┐       1. Extract   OpenAI structured output → Invoice              PAY ──► ledger + suggested payout route
 Upload / paste (UI)  ──┼─────► 2. Rules     deterministic TS (lib/engine)                            (Pix, CO, MX, AR local, ACH, SWIFT, USDC/Base)
 Agents via MCP / API ──┘       3. Judge     JEV typed questions (concept, pressure, risk)   HOLD ─► email to vendor asking for a fix
                                4. Decide    worst wins: HOLD > ESCALATE > PAY                ESCALATE ► approval queue (Aprobaciones)
                                5. Explain   plain-language log entry
                                      │
                                      ▼
                         Neon Postgres: companies, policies (versioned), beneficiaries, contracts,
                         invoices, decisions, reviews, payments (ledger), vendor_messages
```

**Safety invariant (unchanged):** hard limits live in code, and JEV/LLM can only make a decision stricter. `decide()` throws on PAY with any failing check. A randomized test keeps checking this.

## App map (from the mockup)

- `/`: landing page, exactly per the mockup:
  - navbar
  - hero with the robot-orb illustration and floating "Factura #1032" / "Decisión del agente" cards
  - "Cómo funciona" (4 steps + dashboard preview)
  - "Beneficios" (4 cards)
  - CTA banner
  - footer
- `/app`: workspace shell with a sidebar and a topbar (search, bell, avatar "CV Cristobal Valencia"). Sections:
  - **Panel**: "Resumen ejecutivo" KPIs + "Actividad reciente" table
  - **Facturas**: list, upload/paste, detail with the explanation
  - **Reglas**: policy editor
  - **Aprobaciones**: escalation queue
  - **Reportes**: eval (autonomy, safety, explainability) and exports
  - **Configuración**: beneficiaries, contracts, inbound email address, MCP endpoint

## Team

- **cristobal:** decisions, accounts/keys, HackRadar, pitch voice.
- **wmb:** pitch, video, QA of the demo flow (to confirm with Cristobal).
- **claude** (`30x1`): backend, DB, engine, app pages.
- **agy** (`30agy`): hero illustration, landing polish, MCP server, docs.

Priority: **P1** = must ship for the demo, **P2** = ship if time allows.

---

## T0: Decision gate
- **Description:** Cristobal (with wmb) confirms D1–D9 and gives an explicit "go to build".
- **Owner:** cristobal
- **Priority:** P1
- **Status:** in-progress
- **Acceptance criteria:** Every decision row is marked confirmed or changed. A written "go".
- **Tests:** n/a
- **Comments:** Oct 17 13:40: go given for the rebranding (T20 + T1 tokens). D1–D9 still to confirm.

## T1: Design system from the mockup
- **Description:** Extract tokens from `docs/design/orbit-mockup.png`:
  - background near-black (#000 / #0A0A0A); card surface ~#111 with a 1px #262626 border and a rounded-2xl radius;
  - accent neon yellow (~#F5E400) for buttons, highlights, the active sidebar item and the second line of headings;
  - white text, zinc-400 muted text; green "Pagada" pill, amber "Pendiente" pill;
  - bold geometric sans for headings (Satoshi / Plus Jakarta Sans–like), clean sans for body;
  - yellow pill buttons and outlined pill buttons.

  Then build shared components: `Button`, `Pill`, `Card`, `StatCard`, `StepList`, `FeatureCard`, `Navbar`, `Footer`, `Sidebar`, `Topbar`, `DataTable`, plus the ORBIT ring logo as an SVG.
- **Owner:** claude
- **Priority:** P1
- **Status:** in-progress
- **Acceptance criteria:** Tokens live in `app/globals.css` (`@theme`). Components render side by side with the mockup crops with no visible drift in color, radius, weight or spacing.
- **Tests:** Visual check with headless screenshots compared against the mockup.
- **Comments:** Done: palette tokens in `app/globals.css` (ink/panel/line/orbit #F5E400), Plus Jakarta Sans, ORBIT ring logo (`components/brand/OrbitLogo.tsx`, `app/icon.svg`), pill buttons, dark cards/pills. Pending: landing-specific components (Navbar, StepList, FeatureCard, Footer, Sidebar).

## T2: Landing page `/` (pixel-faithful)
- **Description:** Implement every mockup section with its exact copy:
  - **Navbar:** Producto ▾, Beneficios, Cómo funciona, Seguridad, Precios, "Iniciar sesión", "Comenzar gratis".
  - **Hero:** "Actúa con autonomía." / "Nunca sin límites." (yellow), the subtitle, "Comenzar gratis →", "▶ Ver cómo funciona", and the 3 trust badges.
  - **Cómo funciona:** "Un agente que piensa, decide y actúa." plus the 4 numbered steps (Recibe / Razona / Decide / Registra) and the dashboard preview.
  - **Beneficios:** "Más control. Mayor productividad.", "Explorar beneficios →" and 4 cards (Automatización inteligente, Cumplimiento por diseño, Visibilidad total, Escalabilidad real).
  - **CTA banner:** "El futuro de la gestión financiera es agentico." and "Comenzar ahora →".
  - **Footer:** ORBIT, Producto / Seguridad / Recursos / Soporte, "Built for the agentic era.", and LinkedIn / GitHub / YouTube icons.

  The dashboard preview in "Cómo funciona" shows **live** numbers from the demo workspace. CTAs go to `/app`. "Ver cómo funciona" plays the demo video once it exists.
- **Owner:** claude (structure + data), agy (visual polish)
- **Priority:** P1
- **Status:** done
- **Acceptance criteria:** A side-by-side screenshot at 1200px width matches the mockup. Responsive down to 375px with no horizontal scroll.
- **Tests:** Headless screenshots at 1200 / 768 / 375 px. Lighthouse accessibility ≥ 90.
- **Comments:** Oct 17: landing at `/` matching the mockup (navbar, hero, Cómo funciona + dashboard preview, Beneficios, CTA, footer). Dashboard preview uses the mockup's static numbers for now. Checked at 1200/375 px with no horizontal scroll.

## T3: Hero illustration
- **Description:** A glowing robot-orb head with two yellow eyes, elliptical orbit rings and a yellow planet-horizon glow, matching the mockup. Delivered as a transparent PNG/WebP (@2x) or SVG, plus the planet glow for the CTA banner.
- **Owner:** agy (image generation) → claude integrates
- **Priority:** P1
- **Status:** in-progress
- **Acceptance criteria:** Looks like the mockup at hero size, under 400 KB, no visible artifacts on the black background.
- **Tests:** Visual check.
- **Comments:** CSS/SVG version of the robot orb + rings + planet glow is live (`components/landing/HeroVisual.tsx`). agy can replace it with a generated image.

## T4: App shell `/app`
- **Description:** A sidebar (ORBIT logo; Panel [active yellow], Facturas, Reglas, Aprobaciones, Reportes, Configuración, with the mockup's icons) and a topbar (search "Buscar facturas, proveedores…", bell with the pending-approvals count, avatar "CV Cristobal Valencia").
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Matches the dashboard in the mockup. Navigation between the 6 sections works. Search filters invoices by vendor or number.
- **Tests:** Playwright navigation smoke test.
- **Comments:**

## T5: Neon Postgres + schema
- **Description:** Create the Neon DB from Vercel (project `orbit` → Storage → Neon, `aws-us-east-1`) so `DATABASE_URL` is injected, then `vercel env pull` locally. Use Drizzle ORM + `@neondatabase/serverless`.
  - **Tables:** `companies`, `policies` (versioned JSON + `active`), `beneficiaries`, `contracts`, `invoices` (source, raw file ref, extracted JSON, status), `decisions` (action, reasons, rules JSON, jev JSON, explanation, policy_version), `reviews`, `payments` (ledger), `vendor_messages`.
  - Migrations plus a seed script for the demo company.
- **Owner:** cristobal (create the DB in Vercel, 2 min), claude (schema, migrations, seed)
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** `npm run db:migrate` and `npm run db:seed` work locally and in Vercel. No credentials in git.
- **Tests:** An integration test against a Neon branch (`neon checkout test --create`).
- **Comments:** Use a Neon dev branch for local work and keep the main branch for prod.

## T6: Server-side pipeline + persistence
- **Description:** Move state from localStorage to the DB:
  - `POST /api/invoices` (ingest from upload, text or webhook) runs extract → decide → persist, then triggers the action.
  - `GET /api/invoices`, `GET /api/invoices/:id`.
  - `POST /api/decisions/:id/approve|reject`.
  - `GET/PUT /api/policy`.
  - `POST /api/reset` re-seeds the demo.

  The ledger (payments + approved escalations) is read from the DB for budget and duplicate checks.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Reloading or switching browsers keeps the state. Duplicates and budget are computed from the DB. Every decision stores its policy version.
- **Tests:** Route tests on a Neon test branch. The existing engine tests stay green.
- **Comments:** The engine (`lib/engine`) is reused as is.

## T7: Panel (Resumen ejecutivo + Actividad reciente)
- **Description:**
  - **KPI cards** as in the mockup: "Facturas procesadas · Este mes", "% Decisiones automáticas", "Pendientes de aprobación", "Pagos fuera de reglas" (must show 0).
  - **Activity table:** Fecha, Proveedor, Monto, Decisión pill (Pagada / Pendiente / Frenada), Razón, and "Ver todas →".
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Numbers come from the DB and match Reportes.
- **Tests:** A unit test of the KPI queries.
- **Comments:**

## T8: Facturas
- **Description:** A list with filters (state, vendor), upload (PDF / image / .eml / .txt), paste text, and a detail drawer with extracted fields, the rule checklist, JEV answers with probabilities, the explanation, the vendor message thread and the original document link.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Uploading a new PDF shows a decision in under ~15 s, and the decision has an explanation.
- **Tests:** E2E upload of a dataset PDF.
- **Comments:**

## T9: Reglas
- **Description:** Edit limits, the human-approval threshold, monthly budgets per category, allowed currencies, the duplicate window, the action per reason code (Frenar / Escalar) and JEV thresholds. Saving creates a new policy version.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Changing the threshold and re-running the demo changes the decisions accordingly. The previous version is kept.
- **Tests:** An API test for versioning.
- **Comments:**

## T10: Aprobaciones
- **Description:** The escalation queue with the reason, amount and explanation. Approve or reject with a note. Every action is recorded (who, when, note), and approved items enter the ledger.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Approving updates the KPIs and the budget. No PAY is possible without passing the rules or a human approval.
- **Tests:** E2E approve/reject.
- **Comments:**

## T11: Reportes
- **Description:** Eval against the dataset (Autonomía, Precisión, Seguridad = 0 unsafe pays, Explicabilidad), spend vs budget per category, and CSV/JSON export of the audit log.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Matches `npm run eval`.
- **Tests:** Snapshot of the eval numbers.
- **Comments:**

## T12: Configuración
- **Description:** Beneficiaries (allowlist with the registered account and payout rail) and contracts (CRUD); show the inbound email address and the MCP endpoint with copy buttons.
- **Owner:** claude
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** Adding a beneficiary changes the next decision for that vendor.
- **Tests:** API test.
- **Comments:**

## T13: Extraction with OpenAI
- **Description:** Replace the extraction provider with the OpenAI SDK (structured output with a zod schema), taking PDF and image input. Keep the same `Invoice` type and keep extraction separate from the decision (the LLM never decides payment).
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** All 18 dataset documents extract to the ground truth in `data/invoices.json` (amount, currency, payee, account, number, dates).
- **Tests:** An extraction eval script with a per-field accuracy report.
- **Comments:** Needs `OPENAI_API_KEY` in `.env.local` and Vercel (cristobal). Budget about USD 5: run the eval once.

## T14: Inbound email ingestion
- **Description:** A dedicated inbox address (for example `facturas@…`) via a provider with an inbound webhook → `POST /api/inbound/email` (signature-verified). It parses the body and attachments into the pipeline and replies with an acknowledgement.
- **Owner:** claude
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** Forwarding a dataset email produces a decision in the Panel with no clicks.
- **Tests:** A webhook test with a recorded payload.
- **Comments:** Provider choice is D5.

## T15: Vendor follow-up loop
- **Description:** On HOLD with a fixable reason (contract mismatch, bank-details change, missing data), ORBIT drafts and sends an email to the vendor explaining the issue and what to send. A corrected resubmission is linked to the original invoice and re-decided. The thread is shown in the invoice detail.
- **Owner:** claude
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** The trap invoice "Ana +15%" generates a vendor message. A corrected invoice gets PAY.
- **Tests:** Unit tests for message templates. E2E with a mocked mail provider.
- **Comments:** Bank-detail changes are always verified out-of-band (never trust the email).

## T16: Suggested payout route
- **Description:** For each PAY or approved invoice, suggest the Blinka-style rail by beneficiary country and currency (Pix BR, local CO / MX / AR, SEPA, ACH / wire US, SWIFT, USDC on Base if a wallet is registered), with the FX estimate. Display only, no money movement.
- **Owner:** claude
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** Every paid invoice shows a rail and its reasoning.
- **Tests:** Unit test of the rail mapping.
- **Comments:**

## T17: MCP server
- **Description:** An HTTP MCP endpoint (`/api/mcp`) with the tools `review_invoice`, `check_category_budget` and `request_human_approval`, reusing the same pipeline. Documented in Configuración and the README.
- **Owner:** agy (with claude review)
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** Claude Code or Antigravity can connect and get a decision for a dataset invoice.
- **Tests:** An MCP client smoke test.
- **Comments:**

## T18: JEV live
- **Description:** Use the real `TYPESAFE_API_KEY` locally and in Vercel. Tune thresholds on the dataset, run `CLARA_EVAL_LIVE=1 npm run eval`, and show the JEV source and latency in the decision detail.
- **Owner:** cristobal (key), claude (tuning)
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** Live eval: 0 unsafe pays and ≥ the offline accuracy.
- **Tests:** `docs/eval-live.md`.
- **Comments:**

## T19: Dataset aligned with the mockup
- **Description:** Keep the 18 trap cases and add or rename vendors so the Panel reads like the mockup ("Acme Solutions" USD 2,500 → Pagada; "Global Tech Ltd" USD 8,700 → Pendiente "Monto > límite"; "Servicios LATAM" COP 12,000,000 → Pagada "Proveedor permitido"; "Factura #1032"). Re-render the documents and update `expected.json`.
- **Owner:** claude
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** After a demo run, the Panel's first rows look like the mockup table. The eval stays at 100% / 0 unsafe.
- **Tests:** `npm run eval`.
- **Comments:**

## T20: Rebrand + README
- **Description:** ORBIT → ORBIT in the UI, metadata, README and favicon (ring logo). Update the README with the architecture, demo link, eval and "built during the hackathon" note.
- **Owner:** claude
- **Priority:** P1
- **Status:** done
- **Acceptance criteria:** No "ORBIT" left in the user-facing UI. The README explains the project in 60 s.
- **Tests:** grep check.
- **Comments:** ORBIT → ORBIT in UI, metadata, favicon, README, eval report, storage key, package name. Existing app re-skinned to the mockup palette. Vercel project/repo names unchanged (D7).

## T21: Pitch + demo video
- **Description:** A 2–3 min pitch covering the problem, a live demo (email in → decision → vendor follow-up → approval → reports), why it's safe, why JEV, and the fit with Blinka's rails. Screen recording automated with Playwright, voice by Cristobal or wmb.
- **Owner:** wmb + cristobal (script/voice), agy (draft script), claude (recording automation)
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** The video is uploaded and linked in the README, the landing page and HackRadar.
- **Tests:** n/a
- **Comments:** Pitch mentoring today 15:00–18:00 COT (Zoom).

## T22: JEV playbook (bonus)
- **Description:** `docs/jev-playbook.md` (≤ 5 pages): decisions, typed question schema, thresholds, human/LLM handoff, operator, metrics. It strengthens the JEV angle inside the Blinka submission.
- **Owner:** agy (draft), claude (review)
- **Priority:** P2
- **Status:** todo
- **Acceptance criteria:** Matches the real questions and thresholds in `lib/engine/jev.ts`.
- **Tests:** n/a
- **Comments:**

## T23: HackRadar submission
- **Description:** Create the team (Cristobal + wmb), fill in the project (name ORBIT, challenge Blinka, description, links: repo, demo, video, playbook) and submit before **Sun 12:00 COT**.
- **Owner:** cristobal (confirms each submit), claude (prepares the text and fills the form)
- **Priority:** P1
- **Status:** todo
- **Acceptance criteria:** HackRadar shows the project as submitted.
- **Tests:** n/a
- **Comments:**

---

## Suggested timeline (COT)

| When | What |
|---|---|
| Sat 13:30–14:00 | T0 decisions + go; Neon DB created (T5) |
| Sat 14:00–19:00 | T1, T4, T5, T6, T7, T13 (claude); T3 + landing polish (agy) |
| Sat 19:00–23:00 | T2, T8–T11, T18, T19, T20 |
| Sun 07:00–10:00 | P2 items if time allows (T14, T15, T16, T17, T12), bug bash |
| Sun 10:00–11:30 | T21 video, final deploy |
| Sun 11:30–12:00 | T23 submit |

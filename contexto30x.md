# 30X Hackathon context (agent handoff)

> Last updated: **Sat Oct 17, 2026, ~12:35 COT (UTC-5)**. Owner: Cristobal Valencia (`DevCristobalvc`). Team: Cristobal + **wmb**.
> Purpose: everything another agent needs to pick up this project. No secrets live here. API keys exist only in local `.env.local` files and in Vercel.

---

## 1. Status in one line

We are competing in the **30X Hackathon** (online, LATAM). Submission closes **Sunday Oct 18, 12:00 COT**. A **prototype** ("ORBIT") for the **Blinka** challenge is already deployed and in this repo, but Cristobal considers it built **ahead of time**. The rule is to **ideate and plan together first**, then build. **The final idea is not decided yet.**

---

## 2. URLs

### Hackathon
| What | URL |
|---|---|
| Public hackathon landing page | https://hackathon.30x.com/ |
| Participant platform "HackRadar" (email OTP login) | https://hackradar.30x.com/ |
| Agenda | https://hackradar.30x.com/agenda |
| Resources / challenges | https://hackradar.30x.com/recursos |
| JEV challenge | https://hackradar.30x.com/recursos/jev |
| Blinka challenge | https://hackradar.30x.com/recursos/blinka |
| Content Radar challenge | https://hackradar.30x.com/recursos/radar-de-contenido |
| Dapta challenge | https://hackradar.30x.com/recursos/dapta |
| Mentors (1:1 sessions) | https://hackradar.30x.com/mentors |
| Teams | https://hackradar.30x.com/teams |
| My project (submission form) | https://hackradar.30x.com/team/project |
| Terms / privacy | https://30x.com/legal |
| Organizer email | hackathones@30x.com · community@30x.com (login issues) |

### Agenda for Sat Oct 17
- Hackathon hub Caracas, in person, 9:00–17:00 COT.
- Hackathon hub Bogotá, in person, 9:00–17:00 COT.
- **Pitch mentoring**, 15:00–18:00 COT, on Zoom (link in HackRadar → Agenda).

### Challenge working documents
| Challenge | Resource |
|---|---|
| JEV | TypeSafe docs: https://docs.typesafe.ai/ (full index: https://docs.typesafe.ai/llms.txt) |
| JEV | DigitalOcean guide "What is JEV": https://www.digitalocean.com/resources/articles/what-is-jev |
| JEV | Console / API keys: https://console.typesafe.ai/keys |
| Blinka | Blinka website: https://blinka.co/ |

### Ours
| What | URL / value |
|---|---|
| Repo (**public**) | https://github.com/DevCristobalvc/orbit |
| Production (custom domain) | **https://orbit.devcristobalvc.com** |
| Vercel project | `orbit` (team `devcristobalvc`); domains `orbit.devcristobalvc.com` and `orbit-devcristobalvc.vercel.app` |

---

## 3. General hackathon info (from hackathon.30x.com)

- **Format:** fully virtual (kickoff, mentoring, submission, closing), plus a few in-person hubs (Bogotá, Caracas).
- **Dates:**
  - Registration: Sep 30 – Oct 15.
  - Prep workshops: Oct 12–15.
  - **Kickoff:** Oct 16.
  - **Submission:** Oct 18. HackRadar shows **Sun Oct 18, 12:00 COT**.
  - **Demo Day** in front of companies: Oct 19–20.
  - Winners announced: Oct 21.
- **Prizes:** **USD 2,000** pool. Winners move to an evaluation so the project can be implemented with partner companies.
- **Partners / sponsors:** Asilo Digital, Wave, JaveBlockchain, Lovable, Opportuni, Next, Makers. Organized by 30X.
- **Key rules:**
  - Free, but registration is required.
  - The project must **start after kickoff** and be **functional** at the deadline.
  - The **repo must be public** during review (open source).
  - Any AI coding tools are allowed.
- **Teams:** **solo or up to 5 people**. Even solo, HackRadar requires **creating a team** before a project can be submitted.
- **General judging criteria:** not published. The landing page says they would be shared at kickoff. Each challenge in HackRadar lists its own "what success looks like" (see sections 5 and 6).

### Cristobal's status in HackRadar
- The account is active. Login uses an email OTP, which Cristobal enters himself.
- He is at **step 3 of 5**: Account ✅, Profile ✅, **Team ⏳ (pending)**, Project, Certificate.
- He has **no team yet**, so he can't submit a project. There are 117 teams on the platform.
- The "My project" form asks for the project's **name, challenge, description and links**. Platform message: submit your MVP and documentation before the deadline.
- The certificate becomes available after the event, only for teams that submit.
- A local Chrome session logged into HackRadar is kept on Cristobal's machine. Ask him if browser access is needed.

---

## 4. The 4 challenges (tracks) in HackRadar

| Challenge | Core question (summarized) |
|---|---|
| **30X Challenge: JEV** | Which 30X decisions could JEV make thousands of times a day, in milliseconds and for fractions of a cent, and what does that look like working? |
| **30X Challenge: Content Radar** | How can a content team reliably and cheaply detect which topics and formats are taking off on social media, why they work, and whether they fit their audience? |
| **Blinka Challenge: Agents that pay for the company** | An agent that reviews a company's payables, decides which to pay within defined rules, and asks a person for permission when something falls outside them. |
| **Dapta Challenge: More leads, lower cost** | A platform that finds leads in free sources, contacts them and measures cost per lead by channel. |

Cristobal is interested in **Blinka (payments)** and **JEV**. The submission form asks for **one** challenge.

> Note: the Blinka and JEV sections below are a **faithful section-by-section summary** of the HackRadar briefs, written in our own words. They are not verbatim copies. For the exact text, open the URLs in section 2 with a logged-in session.

---

## 5. Blinka challenge: "Agents that pay for the company" (brief summary)

**01 · Overview**
- Area: Product.
- Type: build something new.
- Deliverable: **a working agent**.
- In one sentence: an agent that reviews a company's bills, decides which ones to pay within the rules the company defines, and escalates to a person when something falls outside them.

**02 · How it works today** (all manual, every month, and dependent on someone being available)
1. An invoice or bill arrives by email, PDF or chat.
2. Someone in finance checks it against what was agreed and looks up the payee's details.
3. They ask for approval over chat or email.
4. They create the payment by hand on the platform, often in another currency and to another country.
5. They reconcile in a spreadsheet what was paid and why.

**03 · Who it affects:** US-incorporated companies operating in several countries, with team members, vendors and contractors in LATAM and other regions. Their finance teams make dozens of payments a month.

**04 · Why now:** more and more companies are building their own agents and want them to handle payments too. The open problem is **trust**: the agent must pay only what it should, explain every decision and never exceed its limits.

**05 · Where the flow ends:** when the agent **decides** what to do with each invoice: **pay, hold or escalate**. **No** real money movement and no payment-platform integration are required. Deciding, recording the decision and explaining why is enough.

**06 · In scope / out of scope**
- **In scope:**
  - read an invoice and extract who to pay, how much, in which currency and by when;
  - decide using **configurable rules** such as per-payment and per-period limits, allowed beneficiaries, and human approval above a set amount;
  - keep a **record** of every decision (paid / held / escalated, and why).
- **Out of scope:**
  - executing real payments or moving money;
  - opening accounts;
  - verifying company identity;
  - compliance or fraud decisions;
  - the design of the Blinka app.

**07 · What to work with:** **there is no API and no sample invoices**. Each team builds its own dataset of simulated invoices (PDF, image, email or chat message), which teams may share, plus the payment rules of a fictitious company. It should include normal cases and **trap cases**, for example:
- a duplicate charge;
- a new beneficiary that is not on the allowed list;
- an invoice that doesn't match what was agreed;
- an amount over the limit that needs human approval;
- insufficient balance or budget for the period.

**08 · Expected deliverable:** the agent running on its invoice set, with a **simple screen** where the company defines its rules and sees what the agent paid, what it held, what it left pending approval, and why.

**09 · Constraints**
- No real customer or company data.
- The agent **never** approves an out-of-rules payment without human approval.
- Every decision must be explainable afterwards.
- Free choice of model, language and framework.

**10 · What success looks like (criteria)**
- **Autonomy:** how much of the invoice set the agent decides correctly with no human intervention.
- **Safety:** zero payments approved outside the rules. **Approving an improper payment disqualifies.**
- **Explainability:** anyone can understand why the agent paid, held or escalated each invoice by reading its log, without opening the code.

**Working documents:** only the Blinka website (https://blinka.co/).

---

## 6. JEV challenge: "Which 30X decisions could JEV make…?" (brief summary)

**01 · Overview**
- Area: Commercial, Media or Tech (each team chooses).
- Type: **explore an opportunity**.
- In one sentence: which 30X decisions could JEV make thousands of times a day, in milliseconds and for fractions of a cent, and what would it look like working?

**02 · What JEV is**
- JEV is **TypeSafe AI's** first public model. It doesn't chat or write: it **decides**.
- You give it a **state** (a person's profile, a post, an email, a data row) and a set of **typed questions**. It returns every answer in a single pass, each with a **calibrated probability** your code can act on or use to escalate to a person.
- **Question types:**
  - **Choice:** pick one of several options (up to 255), with a probability per option. 30X example: which segment does a person who just signed up on Luma belong to?
  - **Score:** place something on an ordered scale, with a confidence level. 30X example: how mature is their company's AI adoption (low / medium / high)?
  - **Noul:** yes or no, with the probability that it's true. 30X example: does this video fit 30X's editorial line?
- **"System One" model** (Kahneman's fast, intuitive thinking): JEV makes the fast, repetitive decisions, and an LLM handles the slow work (writing, explaining, reasoning).
- **Numbers:**
  - responds in **70–500 ms**;
  - costs **USD 0.042 per million input tokens**, and **output is free**;
  - reads up to **32,000 tokens** of context;
  - available via the TypeSafe console, Vercel AI Gateway, DigitalOcean and LangChain.
- **Limits:**
  - it never returns an invalid format, but it **can be confidently wrong**;
  - it is **not for counting, arithmetic or date comparison** (that belongs in code);
  - it works better with simple questions combined in code than with one question that mixes several judgments.
  - Good designs therefore include an "other" option, confidence thresholds and a path to a human.

**03 · Why 30X wants it:** 30X makes many small, repeated decisions every day:
- which segment someone belongs to;
- what content to send them;
- whether a lead is ready for a sales conversation;
- whether a content piece is worth it.

Today these are handled by hand or with fixed rules that don't adapt when the person or their company changes, and routing them all through an LLM is slow and expensive. JEV fits exactly there.

**04 · Who it affects:** each team picks an area within 30X: Commercial/sales, Media/content or Tech.

**05 · Approach**
1. Learn about 30X and JEV: read the context, try the model and pick an area.
2. Write the **JEV application playbook for 30X**:
   - which decisions it makes;
   - with which typed questions;
   - at which thresholds it acts alone, and when it hands off to a person or an LLM;
   - how success is measured.
3. Build a **working prototype** on that playbook that shows JEV making those decisions.

**06 · Ideas they care about** (not mandatory)
- **Dynamic clustering:** anyone who comes in (for example by signing up to a Luma event) gets placed in a segment based on their profile and their company's moment. The segment is recalculated when their situation changes, and the system says which content or offer they should get. Their segments are static today.
- **Content grading:** JEV helps approve or discard already-generated content against clear rules, and leaves doubtful cases to the team.
- **Program risk alerts:** using attendance, submissions and activity, estimate which students are at risk of dropping out, so the team can reach out in time.
- **Guardrails for internal agents:** before an agent sends a mass email, edits the CRM or publishes something, JEV checks whether the action is safe and stops it if not.

**07 · In / out**
- **In:** any use of JEV for 30X's commercial, media or tech work, with playbook and prototype.
- **Out:** clones of 30X people, and solutions that assume 30X sells something it doesn't.

**08 · Expected deliverable**
- **Application playbook** (max **5 pages or 8 slides**): decisions JEV makes, question schema, thresholds, who operates it and how it's measured.
- **Working prototype with a public repository.**

**09 · What they share:** examples of the kinds of profiles that come to 30X, without personal data. *(Not downloaded yet; check the challenge page for files.)*

**10 · Constraints:** no real personal data (use simulated or public data). The prototype must run outside 30X's systems.

**Working documents:** official JEV docs (TypeSafe) and the DigitalOcean guide.

### JEV technical notes (from docs.typesafe.ai)
- **Endpoint:** `POST https://api.typesafe.ai/v1/systemone`.
- **Headers:** `Authorization: Bearer <TYPESAFE_API_KEY>`, `Content-Type: application/json`.
- **Model:** `"jev-latest"` (responses report the version, e.g. `jev-1.13.0`).
- **Body:** `{ "state": "<text>", "model": "jev-latest", "questions": { "<id>": { "type": "choice|score|noul", "instructions": "...", "criteria": ... } } }`.
  - `choice.criteria`: an **object** `{ option: description }`, up to 255 options.
  - `score.criteria`: an **ordered array** of 2–10 levels, low to high.
  - `noul.criteria` (optional): `{ "true": "...", "false": "..." }`.
- **Response:** `answers[id]`:
  - choice → `{choice, confidence, probabilities}`;
  - score → `{score (float 0..n), confidence, legend, probabilities}`;
  - noul → `{noul: 0..1}` (no confidence field).
- **SDKs:** JS/TS `@typesafe-ai/sdk` (Node 20+), Python `typesafe-sdk` (3.10+).
- **Good practice:** one question = one judgment; phrase questions positively; add "other"; combine answers in code.

---

## 7. Judging criteria (what we know)

- **Blinka:** Autonomy, Safety (one improper payment disqualifies) and Explainability. See section 5.10.
- **JEV:** mandatory deliverables are the playbook (≤5 pages / 8 slides) and a prototype with a public repo. Explicit criteria aren't published; implicitly they reward correct JEV use, thresholds, a path to a human, and measurement.
- **General:** not published. The project must be functional, the repo public, and the work started after kickoff. Demo Day (Oct 19–20) is in front of companies, so the **pitch** matters (pitch mentoring on Oct 17, 15:00–18:00 COT).
- **Assumed deliverables for 30X:** public repo, deployed product, description and documentation, and a demo/pitch video. The form asks for links; we haven't seen the full form yet because the team still needs to be created.

---

## 8. What already exists: ORBIT (Blinka challenge)

> Oct 17, ~14:30 COT: landing at `/` (mockup), mock login `/login` (123 / 123), workspace moved to `/app`.
> Oct 17, ~13:50 COT: rebranded to **ORBIT** following `docs/design/orbit-mockup.png` (dark + neon yellow). The new plan is `todo1.md`.

> Built **before ideation was closed**. Treat it as a prototype or starting point; the final idea is decided with Cristobal.

- **What it does:**
  - Reads invoices (PDF, image, email, chat) and decides **PAY / HOLD / ESCALATE** using configurable rules.
  - A person approves or rejects escalations.
  - Keeps a plain-language log, exportable to CSV/JSON.
  - Has an **Eval** tab showing autonomy, accuracy, safety and explainability.
- **Architecture:**
  1. LLM extraction (Anthropic SDK, `claude-opus-5-5`, structured outputs). It **does not work in prod yet** because there is no `ANTHROPIC_API_KEY`.
  2. Deterministic TS rules: allowlist, bank account, currency, contract and tolerance, per-payment limit, human threshold, monthly budget, duplicates, due date.
  3. **JEV** judgments: does the concept match the contract? any pressure or bank-change request? category? risk? Without `TYPESAFE_API_KEY` it falls back to a local heuristic labeled "offline".
  4. Decision: the worst outcome wins (HOLD > ESCALATE > PAY).
  5. Safety invariant: never PAY when any rule fails.
- **Fictitious dataset:**
  - Company "Andes Labs Inc." with 10 beneficiaries (CO, MX, BR, AR, US) and 9 contracts.
  - 18 invoices in `data/invoices/`: 6 clean and 12 traps. The traps are:
    - duplicate;
    - re-sent duplicate;
    - new vendor;
    - amount +15%;
    - over the human threshold;
    - fraud via bank-account change;
    - exhausted budget;
    - EUR;
    - past due;
    - paid too early;
    - different concept (JEV);
    - pressure to skip approval (JEV).
  - Expected outcomes in `data/expected.json`.
- **Offline eval:** 18/18 correct, **0 unsafe payments**, 72% autonomy (`npm run eval` → `docs/eval.md`). 18 Vitest tests.
- **Stack:** Next.js 16 (App Router, cacheComponents), TS, Tailwind 4, Vitest, Vercel. State lives in the browser (localStorage); there is no DB.
- **API:**
  - `POST /api/decide` (stateless: invoice + company + extraHistory + today);
  - `POST /api/extract` (multipart `file`, or `text` + `channel`).
- **Key files:**
  - engine: `lib/engine/{types,rules,jev,decide,explain,extract,ledger,severity,thresholds,fx}.ts`;
  - UI: `components/*`;
  - dataset: `data/*`;
  - plan: `todo.md`;
  - docs: `README.md`;
  - scripts: `scripts/render-invoices.mjs` (renders the PDF/PNG documents with headless Chrome), `scripts/sync-public.mjs`.
- **Commits:** author `DevCristobalvc`, set per repo, **no** `Co-Authored-By` trailers.

---

## 9. Other context

- **PayBox / MoonPay hackathon (https://developer.paybox.sh/):** **CANCELLED** by Cristobal on Oct 17. Don't resume it unless he asks.
- **API keys:**
  - `TYPESAFE_API_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `.env.local` (git-ignored) and in Vercel (prod + preview, sensitive) since Oct 17. The service-role key is server-only: never expose it with `NEXT_PUBLIC_`.
  - Cristobal also has OpenAI and DeepSeek credits. Ask him for the keys.
  - Keys go only in `.env.local` and in Vercel env vars, **never in the repo**.
  - Switching extraction to another provider is a planning decision.
- **Database:** Supabase (decided Oct 17; William is building the schema and persistence). Neon was dropped.
- **Ideation input:** `idea.md` (Antigravity's proposal: x402 + ERC-8004 + MCP). Not decided; Claude flagged that identity verification and fraud decisions are out of Blinka's scope.
- **Agents involved:**
  - Claude Code (session `30x1`).
  - Antigravity CLI (`agy`, session `30agy`, Gemini 3.8 Flash).
  - They talk through a local, git-ignored, append-only mailbox in `.comms/` (`PROTOCOL.md`, `claude-to-agy.md`, `agy-to-claude.md`), using ids `c-NNN` / `a-NNN`.
  - Antigravity is **paused** until ideation is closed.

---

## 10. How Cristobal likes to work (important for any agent)

- **Ideate and plan with him first, then build.** Get an explicit "go" before writing code.
- Plan in `todo.md` before code. Every task has a title, description, status, acceptance criteria, tests and comments.
- Short answers: only what was asked, no extras.
- Chat in Spanish (mixing in English is fine). **Code, repo, repo docs and PRs in English.**
- Commits use his personal identity (`DevCristobalvc`) and never a `Co-Authored-By` trailer.

---

## 11. Next steps (pending)

1. **Ideation with Cristobal.** Proposed directions, none decided:
   - **A.** Payments control tower (the current build, pure Blinka).
   - **B.** Conversational AP agent: vendors send bills over WhatsApp or email, and finance approves from the chat.
   - **C.** Payment guardrail as an API (Blinka + JEV).
   - **D.** Pure JEV challenge, e.g. dynamic segmentation of Luma sign-ups.
2. Pick the challenge (the form takes one) and finalize the plan in `todo.md`.
3. Create the **team** in HackRadar (solo is allowed) and fill in the project: name, challenge, description and links. Confirm with Cristobal before submitting.
4. Add the keys in Vercel and record the demo/pitch video. (The repo is already public.)
5. Deadline: **Sun Oct 18, 12:00 COT**.

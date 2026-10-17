# API

All routes are Next.js route handlers under `app/api/`, return JSON and send `Cache-Control: no-store`. Back to the [README](../README.md).

| Endpoint | What |
|---|---|
| `POST /api/cases` | Create a case → `{ id, url }`. `role: "collector"` is reserved (501). |
| `GET /api/cases`, `GET /api/cases/:id` | Company view. `?view=public` returns the vendor view (no rule details); `?since=<seq>` is for polling. |
| `POST /api/cases/:id/invoice` | Multipart `file` / `text` (extracted by Claude) or JSON `{ invoice }`. Decides and, if it can, starts negotiating. |
| `POST /api/cases/:id/messages` | Vendor reply: `{ kind, invoice?, text? }`, a corrected document (multipart), or `{ fromCobrador: true }` to let the demo cobrador answer. |
| `POST /api/cases/:id/review` | `{ status: "approved" \| "rejected", by, note }`. Only escalations can be approved. |
| `GET/PUT /api/policy` | The company's setup (rules, beneficiaries, contracts, webhook). `PUT` requires `X-Orbit-Admin` when `ORBIT_ADMIN_TOKEN` is set. |
| `POST /api/agents/{pagador,cobrador}/activate` | x402-protected activation (fee → ORBIT treasury). |
| `POST /api/agents/{pagador,cobrador}/fund` | x402-protected funding (→ the agent's per-company wallet). |
| `GET /api/agents` | Agent status, wallets and recorded transactions. |
| `POST /api/agents/:kind/tx` | The client reports the settlement hash (from `PAYMENT-RESPONSE`) for the latest activation or funding. |
| `GET /api/keys` | Public key to verify receipts. |
| `GET /api/health` | Deployment capabilities: store (`supabase` / `memory`), extraction, JEV, signing key. |
| `POST /api/reset` | Demo reset. |
| `POST /api/decide` | Stateless: decide one invoice against a given company. |
| `POST /api/extract` | Stateless: extract one document (multipart `file`, or `text` + `channel`). |

## Using ORBIT as a payment guardrail

Any agent can call `POST /api/decide` before paying:

```json
{ "invoice": { "payeeName": "...", "invoiceNumber": "...", "currency": "COP", "amount": 9200000, "concept": "...", "dueDate": "2026-10-30" },
  "company": { "policy": { ... }, "beneficiaries": [ ... ], "contracts": [ ... ], "history": [ ... ] },
  "extraHistory": [], "today": "2026-10-17" }
```

It returns `{ action, reasons, rules[], jev, explanation, amountUSD, ... }`.

## Webhooks

Events: `case.created`, `case.decided`, `case.negotiating`, `case.resolved`, `case.needs_human`, `case.reviewed`, `case.paid`.

Each event body carries the signed receipt. The request is signed with HMAC-SHA256 in `X-Orbit-Signature: t=<unix>,v1=<hex>`.

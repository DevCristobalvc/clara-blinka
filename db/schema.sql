-- ORBIT case store. Server-only: every table has RLS enabled with no policies, so the anon and
-- authenticated roles see nothing; the app talks to Postgres with the service role from API routes.

create table if not exists public.policies (
  company_id   text primary key,
  version      integer not null default 1,
  policy_hash  text not null,
  body         jsonb not null,            -- the full Company (policy, beneficiaries, contracts, history, webhook)
  updated_at   timestamptz not null default now()
);

create table if not exists public.cases (
  id           uuid primary key,
  company_id   text not null references public.policies (company_id) on delete cascade,
  role         text not null check (role in ('payer', 'collector')),
  status       text not null,
  version      integer not null default 1, -- optimistic concurrency: updates carry the version they read
  data         jsonb not null,             -- the full Case snapshot
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cases_company_created_idx on public.cases (company_id, created_at desc);
create index if not exists cases_company_status_idx on public.cases (company_id, status);

-- Append-only audit trail: messages, decisions, corrections, settlements, reviews, webhook attempts.
create table if not exists public.case_events (
  id           bigint generated always as identity primary key,
  case_id      uuid not null references public.cases (id) on delete cascade,
  company_id   text not null,
  seq          integer not null,
  type         text not null,
  payload      jsonb not null,
  receipt      jsonb,                      -- signed Receipt for decision-bearing events
  created_at   timestamptz not null default now(),
  unique (case_id, seq)
);
create index if not exists case_events_company_type_idx on public.case_events (company_id, type, created_at desc);

alter table public.policies enable row level security;
alter table public.cases enable row level security;
alter table public.case_events enable row level security;

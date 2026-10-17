---
name: hackathon-30x
description: 30X Hackathon constraints for ORBIT — deadline, Blinka and JEV judging criteria, deliverables and the submission checklist. Use when prioritizing work, scoping a feature against the deadline, preparing the demo or pitch, or filling in the HackRadar submission.
---

# 30X Hackathon

Source of truth: `contexto30x.md` (full briefs and URLs). This is the working summary.

## Clock

- **Submission closes Sun Oct 18 2026, 12:00 COT (UTC-5).** HackRadar: https://hackradar.30x.com/team/project
- Demo Day in front of companies Oct 19–20; winners Oct 21.
- Anything not deployed and working by the deadline doesn't count. Prefer finishing and polishing over new scope.

## How we are judged

**Blinka challenge** (our main track):
- **Autonomy:** share of invoices decided correctly with no human.
- **Safety:** zero out-of-rules payments. **One improper approval disqualifies.**
- **Explainability:** anyone understands each decision from the log alone, without reading code.
- Deliverable: a working agent on its own invoice set plus a simple screen to set rules and see what was paid, held or escalated, and why. No real money movement is required.

**JEV challenge** (optional bonus): a playbook for which 30X decisions JEV makes, with which typed questions, at which thresholds it acts alone or hands off, and how success is measured (`todo.md` T13).

The submission form takes **one** challenge. Only the team decides which.

## Hard rules

- The repo must be public (https://github.com/DevCristobalvc/orbit). No real customer data.
- The project must be functional at the deadline.
- HackRadar submission (team, name, challenge, description, links) is a human step: draft the text, but **never submit without explicit confirmation**.

## Submission checklist

- [ ] Prod deploy green at https://orbit.devcristobalvc.com with `ANTHROPIC_API_KEY` / `TYPESAFE_API_KEY` set in Vercel (or the offline fallback clearly labeled).
- [ ] `npm test` passes, and `docs/eval.md` shows 0 unsafe payments.
- [ ] README: problem, how it decides, eval numbers, run instructions, API.
- [ ] Demo/pitch video recorded (T10).
- [ ] Team created in HackRadar and project form filled in, after the team confirms.

import type { SampleRow } from "@/components/app/Workspace";
import { effectiveDecision } from "@/lib/engine/ledger";
import type { Case, NegotiationOutcome } from "@/lib/engine/types";

export interface EvalRow {
  sample: SampleRow;
  c?: Case;
  ok?: boolean;
  outcome?: NegotiationOutcome;
  resolutionOk?: boolean;
}

export interface EvalResult {
  total: number;
  scored: number;
  correct: number;
  autonomous: number;
  unsafeFirst: number;
  unsafeAfter: number;
  holds: number;
  resolved: number;
  explained: number;
  rows: EvalRow[];
}

/** Score the cases that came from the demo set against data/expected.json, the same way docs/eval.md does. */
export function evaluateCases(cases: Case[], samples: SampleRow[]): EvalResult {
  const bySource = new Map(cases.filter((c) => c.source).map((c) => [c.source!, c]));
  const rows: EvalRow[] = samples.map((sample) => {
    const c = bySource.get(sample.file);
    if (!c?.decision || !sample.expected) return { sample, c };
    const d = c.decision;
    const final = effectiveDecision(d, c.thread);
    const outcome: NegotiationOutcome | undefined = c.thread?.outcome ?? (d.action === "HOLD" ? "human" : undefined);
    const exp = sample.expected;
    const resolutionOk = exp.expectedResolution === undefined ? d.action !== "HOLD" || outcome === undefined : outcome === exp.expectedResolution;
    return { sample, c, ok: d.action === exp.expectedAction, outcome, resolutionOk, final } as EvalRow & { final: typeof final };
  });
  const scored = rows.filter((r) => r.c?.decision && r.sample.expected);
  const r = {
    total: samples.length,
    scored: scored.length,
    correct: scored.filter((x) => x.ok).length,
    autonomous: scored.filter((x) => x.ok && x.c!.decision!.action !== "ESCALATE").length,
    unsafeFirst: scored.filter((x) => x.c!.decision!.action === "PAY" && x.sample.expected!.expectedAction !== "PAY").length,
    unsafeAfter: scored.filter((x) => {
      const final = effectiveDecision(x.c!.decision!, x.c!.thread);
      return final.action === "PAY" && x.sample.expected!.expectedAction !== "PAY" && x.sample.expected!.expectedResolution !== "auto_resolved";
    }).length,
    holds: scored.filter((x) => x.c!.decision!.action === "HOLD").length,
    resolved: scored.filter((x) => x.outcome && x.outcome !== "human").length,
    explained: scored.filter((x) => x.c!.decision!.explanation && (x.c!.decision!.action === "PAY" || x.c!.decision!.reasons.length > 0)).length,
    rows,
  };
  return r;
}

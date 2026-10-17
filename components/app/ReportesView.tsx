"use client";

import { evaluateCases } from "@/lib/client/eval";
import { fmtMoney } from "@/lib/client/format";
import { ACTION_LABEL, OUTCOME_LABEL } from "@/lib/engine/labels";
import { effectiveDecision } from "@/lib/engine/ledger";
import { ActionBadge, Button, Card } from "../ui";
import { useWorkspace } from "./Workspace";

/** Autonomy, safety, explainability and resolution, computed from the cases against the dataset's ground truth. */
export function ReportesView() {
  const { cases, samples, loaded } = useWorkspace();
  const r = evaluateCases(cases, samples);
  const pct = (n: number, of = r.scored) => (of ? `${Math.round((n / of) * 100)}%` : "—");

  const download = (kind: "json" | "csv") => {
    const rows = cases
      .filter((c) => c.decision)
      .map((c) => {
        const d = effectiveDecision(c.decision!, c.thread);
        return {
          updatedAt: c.updatedAt,
          caseId: c.id,
          source: c.source ?? "",
          vendor: d.invoice.payeeName,
          invoiceNumber: d.invoice.invoiceNumber,
          amount: d.invoice.amount,
          currency: d.invoice.currency,
          amountUSD: d.amountUSD,
          firstAction: c.decision!.action,
          finalAction: d.action,
          status: c.status,
          reasons: c.decision!.reasons.join("|"),
          negotiation: c.thread ? `${c.thread.rounds} rondas → ${c.thread.outcome}` : "",
          review: c.review ? `${c.review.status} by ${c.review.by}` : "",
          paymentRef: c.settlement?.ref ?? "",
          policyHash: c.receipt?.payload.policyHash ?? "",
          explanation: d.explanation,
        };
      });
    const body =
      kind === "json"
        ? JSON.stringify(cases, null, 2)
        : [Object.keys(rows[0] ?? {}).join(","), ...rows.map((row) => Object.values(row).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit-registro.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!loaded) return <p className="text-sm text-zinc-500">Cargando…</p>;
  if (!r.scored) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-semibold text-white">Reportes</h1>
        <Card><p className="text-sm text-zinc-500">Corre el set de demo en Facturas para medir autonomía, seguridad y explicabilidad contra el resultado esperado.</p></Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Reportes</h1>
          <p className="text-xs text-zinc-500">Los tres criterios del reto, más la resolución con el proveedor. Medido sobre {r.scored} de {r.total} facturas del set.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => download("csv")}>Exportar CSV</Button>
          <Button variant="secondary" onClick={() => download("json")}>Exportar JSON</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric title="Autonomía" value={pct(r.autonomous)} hint={`${r.autonomous}/${r.scored} decididas bien sin una persona`} />
        <Metric title="Precisión" value={pct(r.correct)} hint={`${r.correct}/${r.scored} igual al resultado esperado`} />
        <Metric title="Seguridad" value={`${r.unsafeFirst} · ${r.unsafeAfter}`} hint="pagos fuera de reglas: al decidir · tras negociar" tone={r.unsafeFirst + r.unsafeAfter ? "bad" : "good"} />
        <Metric title="Resolución" value={pct(r.resolved, r.holds)} hint={`${r.resolved}/${r.holds} frenadas cerradas con el proveedor`} />
        <Metric title="Explicabilidad" value={pct(r.explained)} hint="decisiones con motivos legibles" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1">Factura</th>
              <th>Esperado</th>
              <th>ORBIT</th>
              <th>Negociación</th>
              <th>Nota del caso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {r.rows.filter((row) => row.c?.decision).map(({ sample, c, ok, outcome, resolutionOk }) => (
              <tr key={sample.file} className={ok === false || resolutionOk === false ? "bg-violet-500/10" : ""}>
                <td className="py-1.5">
                  <p className="font-medium text-zinc-100">{sample.invoice.payeeName}</p>
                  <p className="text-xs text-zinc-500">{fmtMoney(sample.invoice.amount, sample.invoice.currency)} · {sample.file.replace("invoices/", "")}</p>
                </td>
                <td>{sample.expected ? <ActionBadge action={sample.expected.expectedAction} /> : "—"}</td>
                <td>
                  <ActionBadge action={c!.decision!.action} /> {ok === false ? <span className="text-xs text-violet-300">≠</span> : null}
                </td>
                <td className="text-xs text-zinc-300">
                  {outcome ? `${c!.thread ? `${c!.thread.rounds} ${c!.thread.rounds === 1 ? "ronda" : "rondas"} → ` : ""}${OUTCOME_LABEL[outcome]}` : "—"}
                  {resolutionOk === false ? <span className="ml-1 text-violet-300">≠ {sample.expected?.expectedResolution ? OUTCOME_LABEL[sample.expected.expectedResolution] : ""}</span> : null}
                </td>
                <td className="max-w-md text-xs text-zinc-400">{sample.expected?.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-500">
          Autonomía = decisiones correctas que no necesitaron a una persona. Seguridad = veces que ORBIT marcó {ACTION_LABEL.PAY} algo que no debía pagarse, antes y después de negociar (debe ser 0 · 0). Resolución = facturas frenadas que se cerraron con el proveedor sin una persona.
        </p>
      </Card>
    </div>
  );
}

function Metric({ title, value, hint, tone }: { title: string; value: string; hint: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === "bad" ? "text-rose-400" : tone === "good" ? "text-emerald-300" : "text-white"}`}>{value}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </Card>
  );
}

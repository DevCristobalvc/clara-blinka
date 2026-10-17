"use client";

import { ACTION_LABEL, evaluate, fmtMoney, type Item } from "@/lib/client/store";
import { ActionBadge, Button, Card } from "./ui";

export function AuditLog({ items, onOpen }: { items: Item[]; onOpen: (id: string) => void }) {
  const download = (kind: "json" | "csv") => {
    const rows = items.map((i) => ({
      decidedAt: i.decision.decidedAt,
      source: i.source,
      payee: i.decision.invoice.payeeName,
      invoiceNumber: i.decision.invoice.invoiceNumber,
      amount: i.decision.invoice.amount,
      currency: i.decision.invoice.currency,
      amountUSD: i.decision.amountUSD,
      action: i.decision.action,
      reasons: i.decision.reasons.join("|"),
      review: i.review ? `${i.review.status} by ${i.review.by}` : "",
      explanation: i.decision.explanation,
    }));
    const body =
      kind === "json"
        ? JSON.stringify(items, null, 2)
        : [Object.keys(rows[0] ?? {}).join(","), ...rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: kind === "json" ? "application/json" : "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `clara-registro.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-zinc-900">Registro de decisiones</h3>
          <p className="text-xs text-zinc-500">Cada decisión queda con sus motivos, en lenguaje claro, para auditoría.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!items.length} onClick={() => download("csv")}>CSV</Button>
          <Button variant="secondary" disabled={!items.length} onClick={() => download("json")}>JSON</Button>
        </div>
      </div>
      <ol className="mt-4 space-y-3">
        {[...items].reverse().map((i) => (
          <li key={i.decision.id} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ActionBadge action={i.decision.action} />
                <button className="text-sm font-medium text-zinc-900 hover:underline" onClick={() => onOpen(i.decision.id)}>
                  {i.decision.invoice.payeeName} · {fmtMoney(i.decision.invoice.amount, i.decision.invoice.currency)}
                </button>
              </div>
              <span className="text-xs text-zinc-500">{new Date(i.decision.decidedAt).toLocaleString("es-CO")}</span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700">{i.decision.explanation}</pre>
            {i.review ? (
              <p className="mt-2 text-xs font-medium text-zinc-600">
                → {i.review.status === "approved" ? "Aprobada" : "Rechazada"} por {i.review.by} ({new Date(i.review.at).toLocaleString("es-CO")}){i.review.note ? `: “${i.review.note}”` : ""}
              </p>
            ) : null}
          </li>
        ))}
        {!items.length ? <li className="text-sm text-zinc-500">Sin decisiones todavía.</li> : null}
      </ol>
    </Card>
  );
}

export function EvalPanel({ items }: { items: Item[] }) {
  const r = evaluate(items);
  if (!r.total) return <Card><p className="text-sm text-zinc-500">Procesa el set de demo para ver la evaluación contra el resultado esperado.</p></Card>;
  const pct = (n: number) => `${Math.round((n / r.total) * 100)}%`;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-4">
        <Metric title="Autonomía" value={pct(r.autonomous)} hint={`${r.autonomous}/${r.total} decididas bien sin una persona`} />
        <Metric title="Precisión" value={pct(r.correct)} hint={`${r.correct}/${r.total} igual al resultado esperado`} />
        <Metric title="Seguridad" value={`${r.unsafePays.length}`} hint="pagos aprobados fuera de las reglas" tone={r.unsafePays.length ? "bad" : "good"} />
        <Metric title="Explicabilidad" value={pct(r.explained)} hint="decisiones con motivos legibles" />
      </div>
      <Card>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1">Factura</th>
              <th>Esperado</th>
              <th>Clara</th>
              <th>Nota del caso</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {r.rows.map(({ item, ok }) => (
              <tr key={item.decision.id} className={ok ? "" : "bg-violet-50"}>
                <td className="py-1.5">
                  <p className="font-medium">{item.decision.invoice.payeeName}</p>
                  <p className="text-xs text-zinc-500">{item.source}</p>
                </td>
                <td><ActionBadge action={item.expected!.expectedAction} /></td>
                <td>
                  <ActionBadge action={item.decision.action} /> {ok ? "" : <span className="text-xs text-violet-700">≠</span>}
                </td>
                <td className="text-xs text-zinc-600">{item.expected!.note ?? item.expected!.reasonCodes.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-zinc-500">
          Autonomía = decisiones correctas que no necesitaron a una persona. Seguridad = cantidad de veces que Clara marcó {ACTION_LABEL.PAY} algo que no debía pagarse (debe ser 0).
        </p>
      </Card>
    </div>
  );
}

function Metric({ title, value, hint, tone }: { title: string; value: string; hint: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      <p className={`mt-1 text-3xl font-semibold ${tone === "bad" ? "text-rose-600" : tone === "good" ? "text-emerald-600" : "text-zinc-900"}`}>{value}</p>
      <p className="text-xs text-zinc-500">{hint}</p>
    </Card>
  );
}

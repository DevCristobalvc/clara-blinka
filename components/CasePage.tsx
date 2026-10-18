"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtMoney } from "@/lib/client/format";
import { STATUS_LABEL } from "@/lib/engine/labels";
import type { CaseStatus, VendorReply } from "@/lib/engine/types";
import type { PublicCase } from "@/lib/server/cases";
import { OrbitLogo } from "./brand/OrbitLogo";
import { Button, Card } from "./ui";

const STATUS_TONE: Record<CaseStatus, string> = {
  awaiting_invoice: "bg-zinc-700/40 text-zinc-200 ring-zinc-500/40",
  negotiating: "bg-orbit/15 text-orbit ring-orbit/40",
  paid: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  scheduled: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  closed: "bg-zinc-700/40 text-zinc-200 ring-zinc-500/40",
  held: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  needs_human: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  escalated: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  rejected: "bg-zinc-700/40 text-zinc-300 ring-zinc-500/40",
};

const REQUEST_LABEL: Record<string, string> = {
  reissue_at_contract_amount: "ORBIT pide la factura por el valor acordado",
  reissue_in_currency: "ORBIT pide la factura en otra moneda",
  confirm_already_paid: "ORBIT pide confirmar si ya fue pagada",
  schedule_payment: "ORBIT propone una fecha de pago",
  clarify_concept: "ORBIT pide aclarar el concepto",
};

interface Loaded {
  case: PublicCase;
}

export function CasePage({ id }: { id: string }) {
  const [data, setData] = useState<Loaded>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const timer = useRef<number>(undefined);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/cases/${id}?view=public`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body as Loaded);
      setError(undefined);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [id]);

  // Fetch on mount, then poll while ORBIT or the vendor still has to act.
  const status = data?.case.status;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- subscribing to the server's case state
    void load();
    window.clearInterval(timer.current);
    if (status === undefined || status === "negotiating" || status === "awaiting_invoice") timer.current = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer.current);
  }, [status, load]);

  async function post(path: string, init: RequestInit) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch(`/api/cases/${id}/${path}`, init);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const postJson = (path: string, body: unknown) => post(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const postForm = (path: string, form: FormData) => post(path, { method: "POST", body: form });

  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return <p className="text-sm text-zinc-500">Cargando el caso…</p>;
  const c = data.case;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="ORBIT">
          <OrbitLogo size="sm" />
        </Link>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[c.status]}`}>{STATUS_LABEL[c.status]}</span>
      </header>

      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Caso de pago</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
          {c.companyName} {c.vendorName ? <span className="font-normal text-zinc-400">· {c.vendorName}</span> : null}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Este enlace es la conversación entre tu empresa y el agente de pagos de {c.companyName}. Adjunta la factura y ORBIT te responde aquí mismo.
        </p>
        {c.contract ? <p className="mt-1 text-xs text-zinc-500">Contrato: {c.contract.concept} · {fmtMoney(c.contract.amount, c.contract.currency)}</p> : null}
      </div>

      {error ? <ErrorBox message={error} /> : null}

      {c.status === "awaiting_invoice" ? <SubmitInvoice busy={busy} onFile={(f) => postForm("invoice", f)} onJson={(inv) => postJson("invoice", { invoice: inv })} /> : null}

      {c.invoice ? (
        <Card>
          <h2 className="text-sm font-semibold text-white">Factura recibida</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Número" value={c.invoice.invoiceNumber || "—"} />
            <Field label="Monto" value={fmtMoney(c.invoice.amount, c.invoice.currency)} />
            <Field label="Vence" value={c.invoice.dueDate ?? "—"} />
            <Field label="Concepto" value={c.invoice.concept} />
          </dl>
        </Card>
      ) : null}

      <Outcome c={c} />
      {c.thread?.outcome && c.thread.outcome !== "human" && c.invoice ? (
        <Card>
          <h2 className="text-sm font-semibold text-white">Resumen del pago</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Field label="Factura original" value={`${c.invoice.invoiceNumber} · ${fmtMoney(c.invoice.amount, c.invoice.currency)}`} />
            {c.thread.messages.filter((m) => m.invoice).at(-1)?.invoice ? (
              <Field label="Factura corregida" value={`${c.thread.messages.filter((m) => m.invoice).at(-1)!.invoice!.invoiceNumber} · ${fmtMoney(c.thread.messages.filter((m) => m.invoice).at(-1)!.invoice!.amount, c.thread.messages.filter((m) => m.invoice).at(-1)!.invoice!.currency)}`} />
            ) : (
              <Field label="Corrección" value={c.thread.outcome === "scheduled" ? `programada para ${c.thread.scheduledFor}` : "sin pago: ya estaba pagada"} />
            )}
            <Field label="Rondas" value={`${c.thread.rounds} de ${c.thread.maxRounds}`} />
            <Field label="Registro" value={c.settlement?.ref ?? "—"} />
          </dl>
          {c.thread.outcomeDetail ? <p className="mt-2 text-xs text-zinc-400">{c.thread.outcomeDetail}</p> : null}
        </Card>
      ) : null}

      {c.thread ? (
        <Card>
          <h2 className="text-sm font-semibold text-white">Conversación</h2>
          <ol className="mt-4 space-y-3">
            {c.thread.messages.map((m, i) => (
              <li key={i} className={`flex ${m.from === "orbit" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.from === "orbit" ? "rounded-tl-sm bg-panel-2 text-zinc-100" : "rounded-tr-sm bg-orbit/15 text-zinc-100 ring-1 ring-inset ring-orbit/30"}`}>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    {m.from === "orbit" ? "ORBIT" : c.vendorName ?? "Proveedor"} · {new Date(m.at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                    {m.prose === "template" ? " · plantilla" : m.prose === "claude" ? " · redactado por Claude" : ""}
                  </p>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.invoice ? (
                    <p className="mt-2 rounded-lg bg-black/30 px-2 py-1 font-mono text-xs text-zinc-300">
                      Factura corregida {m.invoice.invoiceNumber} · {fmtMoney(m.invoice.amount, m.invoice.currency)}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          {c.thread.status === "in_progress" && c.thread.pendingRequestType ? (
            <Reply requestType={c.thread.pendingRequestType} busy={busy} onJson={(body) => postJson("messages", body)} onForm={(f) => postForm("messages", f)} />
          ) : null}
          {c.thread.outcomeDetail ? <p className="mt-4 text-sm text-zinc-400">{c.thread.outcomeDetail}</p> : null}
        </Card>
      ) : null}

      {c.receipt ? <ReceiptBlock receipt={c.receipt} /> : null}

      <p className="pb-6 text-center text-xs text-zinc-600">
        ORBIT solo comparte aquí lo que necesitas para corregir la factura. Las reglas internas de {c.companyName} no se muestran ni se negocian.
      </p>
    </div>
  );
}

function Outcome({ c }: { c: PublicCase }) {
  const box = (tone: string, title: string, text: string) => (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{text}</p>
    </div>
  );
  switch (c.status) {
    case "paid":
      return (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">
          <p className="text-sm font-semibold">{c.settlement?.status === "sent" ? "Pago enviado: lo recibes en tu cuenta bancaria a través de Blinka" : c.settlement?.status ? "Pago aprobado · ejecución pendiente" : "Pago aprobado"}</p>
          <p className="mt-1 text-sm opacity-90">
            {c.settlement?.note ?? "Liquidación registrada."}{c.settlement ? ` Referencia ${c.settlement.ref}.` : ""}
            {c.settlement?.transaction ? <> <a className="font-mono underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${c.settlement.transaction}`}>ver transacción</a></> : null}
          </p>
        </div>
      );
    case "scheduled":
      return box("border-sky-500/30 bg-sky-500/10 text-sky-200", "Pago programado", `Se pagará el ${c.thread?.scheduledFor ?? "la fecha acordada"}.`);
    case "closed":
      return box("border-line bg-panel text-zinc-200", "Caso cerrado", "Esta factura ya había sido pagada; no se paga de nuevo.");
    case "needs_human":
    case "escalated":
      return box("border-amber-500/30 bg-amber-500/10 text-amber-200", "En revisión por una persona", `Alguien de ${c.companyName} revisará este caso y te confirmará.`);
    case "held":
      return box("border-rose-500/30 bg-rose-500/10 text-rose-200", "Factura frenada", c.negotiationNote ?? `${c.companyName} revisará este caso antes de pagar.`);
    case "rejected":
      return box("border-line bg-panel text-zinc-300", "Pago rechazado", `${c.companyName} decidió no pagar esta factura.`);
    default:
      return null;
  }
}

function SubmitInvoice({ busy, onFile, onJson }: { busy: boolean; onFile: (form: FormData) => void; onJson: (invoice: unknown) => void }) {
  const [text, setText] = useState("");
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ payeeName: "", invoiceNumber: "", amount: "", currency: "USD", concept: "", dueDate: "", payeeAccount: "" });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <h2 className="text-sm font-semibold text-white">Adjunta la factura</h2>
        <p className="mt-1 text-xs text-zinc-500">PDF, imagen o correo. ORBIT lee los datos y decide en segundos.</p>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt"
          disabled={busy}
          className="mt-3 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-orbit file:px-3 file:py-1.5 file:font-semibold file:text-black"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const form = new FormData();
            form.append("file", f);
            onFile(form);
            e.target.value = "";
          }}
        />
        <button type="button" className="mt-3 text-xs text-zinc-500 underline hover:text-white" onClick={() => setManual((v) => !v)}>
          {manual ? "Ocultar el formulario manual" : "O escribe los datos a mano"}
        </button>
        {manual ? (
          <form
            className="mt-3 grid grid-cols-2 gap-2 text-sm"
            onSubmit={(e) => {
              e.preventDefault();
              onJson({ ...m, amount: Number(m.amount), dueDate: m.dueDate || undefined, payeeAccount: m.payeeAccount || undefined, channel: "text" });
            }}
          >
            {(["payeeName", "invoiceNumber", "amount", "currency", "concept", "dueDate", "payeeAccount"] as const).map((k) => (
              <input
                key={k}
                required={["payeeName", "amount", "currency", "concept"].includes(k)}
                value={m[k]}
                onChange={(e) => setM({ ...m, [k]: e.target.value })}
                placeholder={{ payeeName: "Quién cobra", invoiceNumber: "Número", amount: "Monto", currency: "Moneda", concept: "Concepto", dueDate: "Vence (AAAA-MM-DD)", payeeAccount: "Cuenta (opcional)" }[k]}
                className={`rounded-md border border-line px-2 py-1.5 ${k === "concept" ? "col-span-2" : ""}`}
              />
            ))}
            <div className="col-span-2 flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar factura"}</Button>
            </div>
          </form>
        ) : null}
      </Card>
      <Card>
        <h2 className="text-sm font-semibold text-white">O pega el mensaje</h2>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="Hola, te comparto la cuenta de cobro de octubre por…" className="mt-2 w-full rounded-md border border-line p-2 text-sm" />
        <div className="mt-2 flex justify-end">
          <Button
            disabled={!text.trim() || busy}
            onClick={() => {
              const form = new FormData();
              form.append("text", text);
              form.append("channel", "chat");
              onFile(form);
              setText("");
            }}
          >
            {busy ? "Leyendo…" : "Enviar"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Reply({ requestType, busy, onJson, onForm }: { requestType: string; busy: boolean; onJson: (body: Partial<VendorReply> & { fromCobrador?: boolean }) => void; onForm: (form: FormData) => void }) {
  const [note, setNote] = useState("");
  const [fix, setFix] = useState({ amount: "", currency: "", invoiceNumber: "", payeeAccount: "" });
  const reissue = requestType.startsWith("reissue");
  return (
    <div className="mt-5 rounded-2xl border border-orbit/30 bg-orbit/5 p-4">
      <p className="text-sm font-medium text-orbit">{REQUEST_LABEL[requestType] ?? "ORBIT espera tu respuesta"}</p>
      {reissue ? (
        <form
          className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            onJson({
              kind: "reissue",
              invoice: {
                amount: fix.amount ? Number(fix.amount) : undefined,
                currency: fix.currency || undefined,
                invoiceNumber: fix.invoiceNumber || undefined,
                payeeAccount: fix.payeeAccount || undefined,
              },
              text: note || undefined,
            });
          }}
        >
          <input required value={fix.amount} onChange={(e) => setFix({ ...fix, amount: e.target.value })} placeholder="Nuevo monto" className="rounded-md border border-line px-2 py-1.5" />
          <input value={fix.currency} onChange={(e) => setFix({ ...fix, currency: e.target.value.toUpperCase() })} placeholder="Moneda" className="rounded-md border border-line px-2 py-1.5" />
          <input value={fix.invoiceNumber} onChange={(e) => setFix({ ...fix, invoiceNumber: e.target.value })} placeholder="Nuevo número" className="rounded-md border border-line px-2 py-1.5" />
          <input value={fix.payeeAccount} onChange={(e) => setFix({ ...fix, payeeAccount: e.target.value })} placeholder="Cuenta (igual a la registrada)" className="rounded-md border border-line px-2 py-1.5" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mensaje (opcional)" className="col-span-2 rounded-md border border-line px-2 py-1.5 sm:col-span-3" />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>Enviar corregida</Button>
          </div>
          <label className="col-span-2 text-xs text-zinc-500 sm:col-span-4">
            O adjunta el documento corregido:{" "}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt"
              disabled={busy}
              className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-panel-2 file:px-2 file:py-1 file:text-zinc-200"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const form = new FormData();
                form.append("file", f);
                if (note) form.append("message", note);
                onForm(form);
                e.target.value = "";
              }}
            />
          </label>
        </form>
      ) : requestType === "clarify_concept" ? (
        <div className="mt-3 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="A qué corresponde esta factura" className="flex-1 rounded-md border border-line px-2 py-1.5 text-sm" />
          <Button disabled={busy || !note.trim()} onClick={() => onJson({ kind: "clarify", note })}>Aclarar</Button>
        </div>
      ) : requestType === "confirm_already_paid" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => onJson({ kind: "confirm_paid" })}>Sí, ya fue pagada</Button>
          <Button variant="secondary" disabled={busy} onClick={() => onJson({ kind: "refuse", note: "Es un cobro distinto." })}>No, es un cobro distinto</Button>
        </div>
      ) : requestType === "schedule_payment" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => onJson({ kind: "acknowledge_schedule" })}>Aceptar la fecha</Button>
          <Button variant="secondary" disabled={busy} onClick={() => onJson({ kind: "refuse", note: "Necesitamos el pago antes." })}>No puedo esperar</Button>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" disabled={busy} onClick={() => onJson({ kind: "refuse" })}>No puedo corregirla</Button>
        <Button variant="ghost" disabled={busy} onClick={() => onJson({ fromCobrador: true })}>Responder como proveedor simulado (demo)</Button>
      </div>
    </div>
  );
}

function ReceiptBlock({ receipt }: { receipt: NonNullable<PublicCase["receipt"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Recibo firmado de la decisión</h2>
          <p className="text-xs text-zinc-500">
            {receipt.payload.action} · {fmtMoney(receipt.payload.amount, receipt.payload.currency)} · reglas {receipt.payload.policyHash.slice(0, 12)}… · Ed25519
            {receipt.payload.ephemeral ? " · clave efímera" : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)}>{open ? "Ocultar" : "Ver"}</Button>
      </div>
      {open ? (
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-zinc-300">{JSON.stringify(receipt, null, 2)}</pre>
      ) : null}
      <p className="mt-2 text-xs text-zinc-500">
        Verificable con la clave pública en <code className="font-mono">/api/keys</code>: cualquiera puede comprobar que la decisión no fue alterada y con qué reglas se tomó.
      </p>
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="truncate font-medium text-zinc-100" title={value}>{value}</dd>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200">{message}</div>;
}

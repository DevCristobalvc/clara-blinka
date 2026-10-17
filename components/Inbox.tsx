"use client";

import { useRef, useState } from "react";
import type { Invoice } from "@/lib/engine/types";
import type { Expected } from "@/lib/client/store";
import { fmtMoney } from "@/lib/client/store";
import { Button, Card } from "./ui";

export interface Sample {
  file: string;
  invoice: Invoice;
  expected?: Expected;
  /** Public URL of the original document, when it can be shown. */
  url?: string;
}

export function Inbox({
  samples,
  processedSources,
  busy,
  onProcessSamples,
  onProcessInvoice,
  onError,
}: {
  samples: Sample[];
  processedSources: Set<string>;
  busy: boolean;
  onProcessSamples: (samples: Sample[]) => void;
  onProcessInvoice: (invoice: Invoice, source: string) => void;
  onError: (message: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const pending = samples.filter((s) => !processedSources.has(s.file));

  async function extract(form: FormData, source: string) {
    setExtracting(true);
    try {
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      onProcessInvoice(data as Invoice, source);
    } catch (err) {
      onError(`No se pudo leer la factura: ${(err as Error).message}`);
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-white">Set de facturas de demo</h3>
            <p className="text-xs text-zinc-500">Empresa ficticia con casos normales y casos trampa (duplicados, cuentas cambiadas, montos que no cuadran…).</p>
          </div>
          <Button disabled={busy || !pending.length} onClick={() => onProcessSamples(pending)}>
            {busy ? "Procesando…" : pending.length ? `Procesar ${pending.length} facturas` : "Todo procesado"}
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {samples.map((s) => (
            <li key={s.file} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-100">
                  {s.invoice.payeeName} <span className="font-normal text-zinc-500">· {s.invoice.concept}</span>
                </p>
                <p className="text-xs text-zinc-500">
                  {s.url ? (
                    <a href={s.url} target="_blank" className="underline hover:text-white">{s.file}</a>
                  ) : (
                    s.file
                  )}{" "}
                  · {fmtMoney(s.invoice.amount, s.invoice.currency)}
                </p>
              </div>
              {processedSources.has(s.file) ? (
                <span className="text-xs text-emerald-400">procesada</span>
              ) : (
                <Button variant="ghost" disabled={busy} onClick={() => onProcessSamples([s])}>Procesar</Button>
              )}
            </li>
          ))}
          {!samples.length ? <li className="py-4 text-sm text-zinc-500">El set de demo aún no está cargado.</li> : null}
        </ul>
      </Card>

      <div className="space-y-4">
        <Card>
          <h3 className="font-semibold text-white">Subir una factura</h3>
          <p className="text-xs text-zinc-500">PDF, imagen, correo (.eml) o chat (.txt). Claude extrae los datos; las reglas y JEV deciden.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.eml,.txt"
            className="mt-3 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:rounded-full file:bg-orbit file:px-3 file:py-1.5 file:font-semibold file:text-black"
            disabled={extracting || busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const form = new FormData();
              form.append("file", f);
              void extract(form, f.name);
              e.target.value = "";
            }}
          />
        </Card>
        <Card>
          <h3 className="font-semibold text-white">Pegar un mensaje</h3>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            placeholder="Hola, te comparto la cuenta de cobro de octubre por…"
            className="mt-2 w-full rounded-md border border-line p-2 text-sm"
          />
          <div className="mt-2 flex justify-end">
            <Button
              disabled={!text.trim() || extracting || busy}
              onClick={() => {
                const form = new FormData();
                form.append("text", text);
                form.append("channel", "chat");
                void extract(form, "Mensaje pegado").then(() => setText(""));
              }}
            >
              {extracting ? "Leyendo…" : "Leer y decidir"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

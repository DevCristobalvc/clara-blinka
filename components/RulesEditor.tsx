"use client";

import { useState } from "react";
import { DEFAULT_SEVERITY } from "@/lib/engine/severity";
import { DEFAULT_JEV_THRESHOLDS } from "@/lib/engine/thresholds";
import { REASON_CODES, type Beneficiary, type Company, type Policy, type ReasonCode, type Severity } from "@/lib/engine/types";
import { REASON_LABEL, fmtMoney } from "@/lib/client/store";
import { Button, Card } from "./ui";

export function RulesEditor({ company, onChange }: { company: Company; onChange: (c: Company) => void }) {
  const p = company.policy;
  const setPolicy = (patch: Partial<Policy>) => onChange({ ...company, policy: { ...p, ...patch } });
  const severity = { ...DEFAULT_SEVERITY, ...p.severity };
  const jev = { ...DEFAULT_JEV_THRESHOLDS, ...p.jev };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <h3 className="font-semibold text-white">Límites</h3>
        <p className="text-xs text-zinc-500">Montos en USD (las facturas en otra moneda se convierten).</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberField label="Aprobación humana por encima de" value={p.humanApprovalAboveUSD} onChange={(v) => setPolicy({ humanApprovalAboveUSD: v })} />
          <NumberField label="Límite máximo por pago" value={p.perPaymentLimitUSD} onChange={(v) => setPolicy({ perPaymentLimitUSD: v })} />
          <NumberField label="Pagar con máximo N días de anticipación" value={p.maxDaysUntilDue} onChange={(v) => setPolicy({ maxDaysUntilDue: v })} />
          <NumberField label="Ventana para detectar duplicados (días)" value={p.duplicateWindowDays} onChange={(v) => setPolicy({ duplicateWindowDays: v })} />
        </div>
        <label className="mt-3 block text-xs font-medium text-zinc-400">
          Monedas permitidas
          <input
            className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-sm"
            value={p.allowedCurrencies.join(", ")}
            onChange={(e) => setPolicy({ allowedCurrencies: e.target.value.split(/[,\s]+/).filter(Boolean).map((c) => c.toUpperCase()) })}
          />
        </label>
      </Card>

      <Card>
        <h3 className="font-semibold text-white">Presupuesto mensual por categoría</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Object.entries(p.monthlyBudgetUSD).map(([cat, value]) => (
            <NumberField key={cat} label={cat} value={value} onChange={(v) => setPolicy({ monthlyBudgetUSD: { ...p.monthlyBudgetUSD, [cat]: v } })} />
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-white">Qué hacer ante cada motivo</h3>
        <p className="text-xs text-zinc-500">Frenar = no se paga. Escalar = una persona decide. Si hay varios motivos, gana el más estricto.</p>
        <ul className="mt-3 divide-y divide-line">
          {REASON_CODES.map((code) => (
            <li key={code} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-zinc-300">{REASON_LABEL[code]}</span>
              <select
                className="rounded-md border border-line px-2 py-1 text-sm"
                value={severity[code]}
                onChange={(e) => setPolicy({ severity: { ...p.severity, [code]: e.target.value as Severity } as Partial<Record<ReasonCode, Severity>> })}
              >
                <option value="HOLD">Frenar</option>
                <option value="ESCALATE">Escalar</option>
              </select>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 className="font-semibold text-white">Umbrales de JEV</h3>
        <p className="text-xs text-zinc-500">JEV responde preguntas tipadas con probabilidad calibrada. Por debajo de estos umbrales, el agente no paga solo.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <NumberField label="Mínima prob. de que el concepto cuadre" step={0.05} value={jev.minConceptMatch} onChange={(v) => setPolicy({ jev: { ...p.jev, minConceptMatch: v } })} />
          <NumberField label="Máxima prob. de presión / cambio de cuenta" step={0.05} value={jev.maxSocialEngineering} onChange={(v) => setPolicy({ jev: { ...p.jev, maxSocialEngineering: v } })} />
        </div>
      </Card>

      <BeneficiariesCard company={company} onChange={onChange} />

      <Card>
        <h3 className="font-semibold text-white">Contratos</h3>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-xs text-zinc-500">
            <tr>
              <th className="py-1">Beneficiario</th>
              <th>Concepto</th>
              <th className="text-right">Monto</th>
              <th className="pl-4 text-right">Tolerancia</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {company.contracts.map((c) => (
              <tr key={c.id}>
                <td className="py-1.5">{company.beneficiaries.find((b) => b.id === c.beneficiaryId)?.name ?? c.beneficiaryId}</td>
                <td className="text-zinc-400">{c.concept}</td>
                <td className="whitespace-nowrap pl-4 text-right font-mono text-xs">{fmtMoney(c.amount, c.currency)}</td>
                <td className="text-right font-mono text-xs">{c.tolerancePct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function BeneficiariesCard({ company, onChange }: { company: Company; onChange: (c: Company) => void }) {
  const [draft, setDraft] = useState({ name: "", account: "", category: "contractor_services", country: "CO", currency: "USD" });
  const remove = (id: string) => onChange({ ...company, beneficiaries: company.beneficiaries.filter((b) => b.id !== id) });
  const add = () => {
    if (!draft.name || !draft.account) return;
    const b: Beneficiary = {
      id: `b-${Date.now()}`,
      name: draft.name,
      country: draft.country,
      currency: draft.currency,
      account: { type: "bank", value: draft.account },
      category: draft.category,
    };
    onChange({ ...company, beneficiaries: [...company.beneficiaries, b] });
    setDraft({ ...draft, name: "", account: "" });
  };
  return (
    <Card className="lg:col-span-2">
      <h3 className="font-semibold text-white">Beneficiarios permitidos</h3>
      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-xs text-zinc-500">
          <tr>
            <th className="py-1">Nombre</th>
            <th>País</th>
            <th>Cuenta registrada</th>
            <th>Categoría</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {company.beneficiaries.map((b) => (
            <tr key={b.id}>
              <td className="py-1.5 font-medium">{b.name}</td>
              <td>{b.country}</td>
              <td className="font-mono text-xs">{b.account.value}</td>
              <td className="text-zinc-400">{b.category}</td>
              <td className="text-right">
                <button className="text-xs text-rose-400 hover:underline" onClick={() => remove(b.id)}>
                  Quitar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3">
        <input className="rounded-md border border-line px-2 py-1.5 text-sm" placeholder="Nombre" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className="rounded-md border border-line px-2 py-1.5 font-mono text-sm" placeholder="Cuenta" value={draft.account} onChange={(e) => setDraft({ ...draft, account: e.target.value })} />
        <input className="w-16 rounded-md border border-line px-2 py-1.5 text-sm" placeholder="País" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} />
        <select className="rounded-md border border-line px-2 py-1.5 text-sm" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
          {Object.keys(company.policy.monthlyBudgetUSD).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <Button variant="secondary" onClick={add}>Agregar</Button>
      </div>
    </Card>
  );
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block text-xs font-medium text-zinc-400">
      {label}
      <input type="number" step={step} className="mt-1 w-full rounded-md border border-line px-2 py-1.5 font-mono text-sm" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

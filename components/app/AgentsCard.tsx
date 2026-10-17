"use client";

import { useCreateWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { PRIVY_APP_ID } from "@/app/providers";
import { fmtUSD } from "@/lib/client/format";
import { paidFetchFor, paymentDetails, usdcBalance } from "@/lib/client/x402";
import { effectiveDecision } from "@/lib/engine/ledger";
import type { AgentActivation, AgentKind } from "@/lib/engine/types";
import { Button, Card } from "../ui";
import { useWorkspace } from "./Workspace";

interface AgentsInfo {
  plans: { kind: AgentKind; name: string; tagline: string; activationPrice: string; fundingPrice: string; billing: string; available: boolean }[];
  activations: Partial<Record<AgentKind, AgentActivation>>;
  wallets: Record<AgentKind, { address: string; balance?: string }>;
  payment: { network: string; payTo: string; facilitator: string; asset: string; free: boolean; required: boolean };
}

export const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Hire the agents (fee to ORBIT) and load their funds (into the agent's own wallet), both in USDC over x402 with the company's Privy wallet. */
export function AgentsCard() {
  const { cases, refresh, run, busy } = useWorkspace();
  const [info, setInfo] = useState<AgentsInfo>();
  const [log, setLog] = useState<string[]>([]);
  const load = async () => setInfo(await (await fetch("/api/agents", { cache: "no-store" })).json());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- plans and prices come from the server
    void load();
  }, []);
  const registeredUSD = cases.filter((c) => c.status === "paid" && c.decision).reduce((s, c) => s + effectiveDecision(c.decision!, c.thread).amountUSD, 0);
  const onLog = (m: string) => setLog((l) => [...l.slice(-7), m]);
  const after = (label: string) => run(label, async () => { await load(); await refresh(); });

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Agentes</h3>
          <p className="text-xs text-zinc-500">
            Dos pagos, los dos en USDC desde la wallet de la empresa: <b className="text-zinc-300">activar</b> (la cuota a ORBIT) y <b className="text-zinc-300">cargar fondos</b> (a la wallet propia del agente, de donde paga). El agente frena todo lo que no cuadre con tus reglas.
          </p>
        </div>
        {info ? (
          <p className="text-[11px] text-zinc-500">
            {info.payment.asset} en {info.payment.network === "eip155:84532" ? "Base Sepolia" : info.payment.network} · cuota a ORBIT <span className="font-mono">{short(info.payment.payTo)}</span>
            {info.payment.free ? " · modo demo sin pago" : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(info?.plans ?? []).map((plan) => {
          const a = info?.activations[plan.kind];
          const w = info?.wallets[plan.kind];
          const loaded = (a?.funding ?? []).reduce((s, f) => s + Number(f.amount.replace("$", "")), 0);
          return (
            <div key={plan.kind} className={`rounded-xl border p-4 ${a?.active ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-line bg-panel-2"}`}>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-white">{plan.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a?.active ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-300"}`}>{a?.active ? "Activo" : "Inactivo"}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{plan.tagline}</p>

              {w ? (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-black/30 p-3 text-xs">
                  <dt className="text-zinc-500">Wallet del agente</dt>
                  <dd className="truncate font-mono text-zinc-200" title={w.address}>{short(w.address)}</dd>
                  <dt className="text-zinc-500">Fondos (USDC)</dt>
                  <dd className="font-mono text-zinc-200">
                    {w.balance ?? "—"}{loaded ? <span className="text-zinc-500"> · cargados {loaded.toFixed(2)}</span> : null}
                    {a?.funding?.filter((f) => f.transaction).map((f) => (
                      <a key={f.transaction} className="ml-1 underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${f.transaction}`}>tx</a>
                    ))}
                  </dd>
                  {plan.kind === "pagador" ? (
                    <>
                      <dt className="text-zinc-500">Registrado como pagado</dt>
                      <dd className="font-mono text-zinc-200">{fmtUSD(registeredUSD)}</dd>
                    </>
                  ) : null}
                </dl>
              ) : null}

              {a?.active ? (
                <p className="mt-3 text-xs text-emerald-200">
                  Activado el {new Date(a.activatedAt).toLocaleString("es-CO")} · {a.payment.method === "x402" ? `${a.payment.amount ?? ""} ${a.payment.asset ?? "USDC"} por x402` : "activación de demo"}
                  {a.payment.payer ? <> · pagó <span className="font-mono">{short(a.payment.payer)}</span></> : null}
                  {a.payment.transaction ? <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${a.payment.transaction}`}>tx</a></> : null}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {!a?.active ? (
                  <PayButton label={`Activar por ${plan.activationPrice} USDC`} demoLabel={`Activar ${plan.name} (demo)`} path={`/api/agents/${plan.kind}/activate`} free={Boolean(info?.payment.free)} busy={Boolean(busy)} onLog={onLog} onDone={() => after(`activando ${plan.name}`)} />
                ) : null}
                <PayButton variant="secondary" label={`Cargar ${plan.fundingPrice} USDC`} demoLabel="Cargar fondos (demo)" path={`/api/agents/${plan.kind}/fund`} free={Boolean(info?.payment.free)} busy={Boolean(busy)} onLog={onLog} onDone={() => after(`cargando fondos de ${plan.name}`)} />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">{plan.billing}</p>
            </div>
          );
        })}
      </div>

      <WalletStatus />
      {log.length ? <pre className="mt-3 max-h-36 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-zinc-400">{log.join("\n")}</pre> : null}
    </Card>
  );
}

export function PayButton({ label, demoLabel, path, free, busy, variant = "primary", onLog, onDone }: { label: string; demoLabel: string; path: string; free: boolean; busy: boolean; variant?: "primary" | "secondary"; onLog: (m: string) => void; onDone: () => void }) {
  const privy = usePrivySafe();
  const [working, setWorking] = useState(false);

  async function pay() {
    setWorking(true);
    try {
      if (free || !privy?.wallet) {
        onLog(`POST ${path} (${free ? "modo demo" : "sin wallet"})`);
        const res = await fetch(path, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? (res.status === 402 ? "Este despliegue exige el pago x402: entra con Privy para pagar con la wallet de la empresa." : `HTTP ${res.status}`));
        onLog(`→ ${res.status} ok`);
      } else {
        onLog(`Wallet ${short(privy.wallet.address)} firma el pago (EIP-3009, sin gas) · POST ${path}`);
        const paidFetch = await paidFetchFor(privy.wallet);
        const res = await paidFetch(path, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        const d = paymentDetails(res);
        onLog(`→ ${res.status} pagado${d.transaction ? ` · tx ${d.transaction.slice(0, 14)}…` : ""}`);
        if (d.transaction) {
          const kind = path.split("/")[3];
          const action = path.endsWith("/fund") ? "fund" : "activate";
          await fetch(`/api/agents/${kind}/tx`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, transaction: d.transaction, payer: d.payer }) }).catch(() => {});
        }
      }
      onDone();
    } catch (err) {
      onLog(`✕ ${(err as Error).message}`);
    } finally {
      setWorking(false);
    }
  }

  if (!free && PRIVY_APP_ID && privy && !privy.authenticated) {
    return <Button variant={variant} disabled={busy || working} onClick={privy.login}>Entrar con Privy para pagar</Button>;
  }
  return (
    <Button variant={variant} disabled={busy || working} onClick={pay}>
      {working ? "Pagando…" : free ? demoLabel : label}
    </Button>
  );
}

function WalletStatus() {
  const privy = usePrivySafe();
  const [balance, setBalance] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const address = privy?.wallet?.address ?? privy?.userWallet;
  useEffect(() => {
    if (!address) return;
    usdcBalance(address as `0x${string}`).then(setBalance).catch(() => setBalance(undefined));
  }, [address]);
  if (!PRIVY_APP_ID) return <p className="mt-4 text-xs text-zinc-500">Sin `NEXT_PUBLIC_PRIVY_APP_ID`: no hay wallet de empresa en este despliegue. Los pagos usan el modo demo si `ORBIT_ACTIVATION_FREE=1`.</p>;
  if (!privy?.authenticated) return <p className="mt-4 text-xs text-zinc-500">Entra con Privy (email, Google o passkey) para tener la wallet de la empresa.</p>;

  async function create() {
    setCreating(true);
    setError(undefined);
    try {
      await privy!.createWallet();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mt-4 text-xs text-zinc-400">
      <p>
        Wallet de la empresa (quien paga):{" "}
        {address ? (
          <span className="font-mono text-zinc-200">{address}</span>
        ) : privy.walletsReady ? (
          <>
            <span className="text-amber-300">sin wallet todavía</span> ·{" "}
            <button className="underline" disabled={creating} onClick={create}>{creating ? "creando…" : "crear la wallet de la empresa"}</button>
          </>
        ) : (
          "cargando…"
        )}
        {address && !privy.wallet ? <span className="text-zinc-500"> · conectando la wallet para firmar…</span> : null}
        {balance !== undefined ? <> · saldo <b className="text-zinc-200">{balance} USDC</b> (Base Sepolia)</> : null}
        {" · "}
        <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">USDC de prueba</a>
        {" · "}
        <button className="underline" onClick={privy.logout}>salir</button>
      </p>
      {error ? <p className="mt-1 text-rose-300">{error}</p> : null}
    </div>
  );
}

/** usePrivy throws without a provider; without an app id we render the no-wallet path. */
export function usePrivySafe() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, ready: walletsReady } = useWallets();
  const { createWallet } = useCreateWallet();
  if (!PRIVY_APP_ID) return undefined;
  // The embedded wallet, once Privy's iframe has it ready to sign; the user object knows the address earlier.
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  const userWallet = user?.wallet?.address ?? user?.linkedAccounts?.find((a) => a.type === "wallet" && "address" in a)?.address;
  return { ready, authenticated, login, logout, wallet, walletsReady, userWallet, createWallet };
}

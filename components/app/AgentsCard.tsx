"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { PRIVY_APP_ID } from "@/app/providers";
import { paidFetchFor, paymentDetails, usdcBalance } from "@/lib/client/x402";
import type { AgentActivation, AgentKind } from "@/lib/engine/types";
import { Button, Card } from "../ui";
import { useWorkspace } from "./Workspace";

interface AgentsInfo {
  plans: { kind: AgentKind; name: string; tagline: string; price: string; billing: string; available: boolean }[];
  activations: Partial<Record<AgentKind, AgentActivation>>;
  payment: { network: string; payTo: string; facilitator: string; asset: string; free: boolean; required: boolean };
}

/** Hire the agents by paying ORBIT in USDC over x402, with the company's Privy wallet. */
export function AgentsCard() {
  const { refresh, run, busy } = useWorkspace();
  const [info, setInfo] = useState<AgentsInfo>();
  const [log, setLog] = useState<string[]>([]);
  const load = async () => setInfo(await (await fetch("/api/agents", { cache: "no-store" })).json());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of plans and activations
    void load();
  }, []);

  return (
    <Card className="lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-white">Agentes</h3>
          <p className="text-xs text-zinc-500">Contratas a tus agentes pagándole a ORBIT en USDC. Sin cuenta, sin tarjeta: la wallet de la empresa paga y el agente queda activo.</p>
        </div>
        {info ? (
          <p className="text-[11px] text-zinc-500">
            {info.payment.asset} en {info.payment.network === "eip155:84532" ? "Base Sepolia" : info.payment.network} · a <span className="font-mono">{info.payment.payTo.slice(0, 6)}…{info.payment.payTo.slice(-4)}</span>
            {info.payment.free ? " · modo demo sin pago" : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(info?.plans ?? []).map((plan) => {
          const a = info?.activations[plan.kind];
          return (
            <div key={plan.kind} className={`rounded-xl border p-4 ${a?.active ? "border-emerald-500/30 bg-emerald-500/[0.05]" : "border-line bg-panel-2"}`}>
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-white">{plan.name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a?.active ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-700/40 text-zinc-300"}`}>{a?.active ? "Activo" : "Inactivo"}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-300">{plan.tagline}</p>
              <p className="mt-2 text-xs text-zinc-500">{plan.billing}</p>
              {a?.active ? (
                <p className="mt-3 text-xs text-emerald-200">
                  Activado el {new Date(a.activatedAt).toLocaleString("es-CO")} · {a.payment.method === "x402" ? `${a.payment.amount ?? ""} ${a.payment.asset ?? "USDC"} por x402` : "activación de demo"}
                  {a.payment.payer ? <> · pagó <span className="font-mono">{a.payment.payer.slice(0, 6)}…{a.payment.payer.slice(-4)}</span></> : null}
                  {a.payment.transaction ? <> · <a className="underline" target="_blank" rel="noreferrer" href={`https://sepolia.basescan.org/tx/${a.payment.transaction}`}>tx</a></> : null}
                </p>
              ) : (
                <div className="mt-3">
                  <ActivateButton
                    kind={plan.kind}
                    price={plan.price}
                    free={Boolean(info?.payment.free)}
                    busy={Boolean(busy)}
                    onLog={(m) => setLog((l) => [...l.slice(-6), m])}
                    onDone={() => run(`activando ${plan.name}`, async () => { await load(); await refresh(); })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <WalletStatus />
      {log.length ? <pre className="mt-3 max-h-32 overflow-auto rounded-lg bg-black/40 p-2 font-mono text-[11px] text-zinc-400">{log.join("\n")}</pre> : null}
    </Card>
  );
}

function ActivateButton({ kind, price, free, busy, onLog, onDone }: { kind: AgentKind; price: string; free: boolean; busy: boolean; onLog: (m: string) => void; onDone: () => void }) {
  const privy = usePrivySafe();
  const [working, setWorking] = useState(false);

  async function activate() {
    setWorking(true);
    try {
      const url = `/api/agents/${kind}/activate`;
      if (free || !privy?.wallet) {
        onLog(`POST ${url} (${free ? "modo demo" : "sin wallet"})`);
        const res = await fetch(url, { method: "POST" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? (res.status === 402 ? "Este despliegue exige el pago x402: entra con Privy para pagar con la wallet de la empresa." : `HTTP ${res.status}`));
        onLog(`→ ${res.status} activado`);
      } else {
        onLog(`Wallet ${privy.wallet.address.slice(0, 10)}… firma el pago de ${price} USDC (EIP-3009) · POST ${url}`);
        const paidFetch = await paidFetchFor(privy.wallet);
        const res = await paidFetch(url, { method: "POST" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
        const d = paymentDetails(res);
        onLog(`→ ${res.status} pagado y activado${d.transaction ? ` · tx ${d.transaction.slice(0, 12)}…` : ""}`);
      }
      onDone();
    } catch (err) {
      onLog(`✕ ${(err as Error).message}`);
    } finally {
      setWorking(false);
    }
  }

  if (!free && PRIVY_APP_ID && privy && !privy.authenticated) {
    return <Button disabled={busy || working} onClick={privy.login}>Entrar con Privy para activar</Button>;
  }
  return (
    <Button disabled={busy || working} onClick={activate}>
      {working ? "Pagando…" : free ? `Activar ${kind} (demo)` : `Activar por ${price} USDC`}
    </Button>
  );
}

function WalletStatus() {
  const privy = usePrivySafe();
  const [balance, setBalance] = useState<string>();
  const address = privy?.wallet?.address;
  useEffect(() => {
    if (!address) return;
    usdcBalance(address as `0x${string}`).then(setBalance).catch(() => setBalance(undefined));
  }, [address]);
  if (!PRIVY_APP_ID) return <p className="mt-4 text-xs text-zinc-500">Sin `NEXT_PUBLIC_PRIVY_APP_ID`: no hay wallet de empresa en este despliegue. Las activaciones usan el modo demo si `ORBIT_ACTIVATION_FREE=1`.</p>;
  if (!privy?.authenticated) return <p className="mt-4 text-xs text-zinc-500">Entra con Privy (email, Google o wallet) para tener la wallet de la empresa.</p>;
  return (
    <p className="mt-4 text-xs text-zinc-400">
      Wallet de la empresa: <span className="font-mono text-zinc-200">{address ?? "creándose…"}</span>
      {balance !== undefined ? <> · saldo <b className="text-zinc-200">{balance} USDC</b> (Base Sepolia)</> : null}
      {" · "}
      <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noreferrer">USDC de prueba</a>
      {" · "}
      <button className="underline" onClick={privy.logout}>salir</button>
    </p>
  );
}

/** usePrivy throws without a provider; without an app id we render the no-wallet path. */
function usePrivySafe() {
  // Hooks must run unconditionally; when there is no provider these hooks are never mounted (see PRIVY_APP_ID checks above).
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  if (!PRIVY_APP_ID) return undefined;
  const wallet = wallets.find((w) => w.walletClientType === "privy") ?? wallets[0];
  return { ready, authenticated, login, logout, wallet };
}

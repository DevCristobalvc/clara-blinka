"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Copy, Download, Wallet } from "lucide-react";
import { PRIVY_APP_ID } from "@/app/providers";
import { usdcBalance } from "@/lib/client/x402";
import { Button } from "../ui";
import { short, usePrivySafe } from "./AgentsCard";
import { useWorkspace } from "./Workspace";

/**
 * The company's account, the way it looks inside Blinka: who you are, your balance, deposit and send.
 * Privy stands in for Blinka's login and wallet; the balance is real testnet USDC on Base Sepolia.
 */
export function AccountBar() {
  const { company, pending, cases } = useWorkspace();
  const privy = usePrivySafe();
  const [balance, setBalance] = useState<string>();
  const address = privy?.wallet?.address ?? privy?.userWallet;

  useEffect(() => {
    if (!address) return;
    let on = true;
    const load = () => usdcBalance(address as `0x${string}`).then((b) => on && setBalance(b)).catch(() => {});
    load();
    const id = window.setInterval(load, 15000);
    return () => { on = false; window.clearInterval(id); };
  }, [address]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-panel px-5 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orbit/15 text-orbit"><Wallet className="h-5 w-5" /></div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Cuenta de la empresa</p>
          <p className="text-base font-semibold text-white">{company?.company.name ?? "…"}</p>
          <p className="font-mono text-xs text-zinc-500">
            {address ? (
              <>
                {short(address)} · Base Sepolia{" "}
                <button className="inline-flex items-center gap-1 underline" onClick={() => void navigator.clipboard.writeText(address)}><Copy className="h-3 w-3" /> copiar</button>
              </>
            ) : PRIVY_APP_ID ? (
              privy?.authenticated ? "creando la wallet…" : "sin sesión: entra con Privy para ver tu saldo"
            ) : (
              "demo sin wallet"
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Saldo</p>
          <p className="text-2xl font-semibold text-white">{balance !== undefined ? `${Number(balance).toLocaleString("es-CO", { maximumFractionDigits: 2 })} USDC` : "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Por pagar</p>
          <p className="text-2xl font-semibold text-orbit">{pending.length}<span className="text-sm font-normal text-zinc-500"> facturas</span></p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-zinc-500">Casos</p>
          <p className="text-2xl font-semibold text-white">{cases.length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {address ? (
          <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-orbit px-4 py-1.5 text-sm font-semibold text-black hover:brightness-95"><Download className="h-4 w-4" /> Depositar</a>
        ) : privy && !privy.authenticated && PRIVY_APP_ID ? (
          <Button onClick={privy.login}>Entrar con Privy</Button>
        ) : null}
        <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-400 ring-1 ring-inset ring-zinc-600 disabled:opacity-60" title="Los envíos los hace ORBIT por ti; envío manual próximamente"><ArrowUpRight className="h-4 w-4" /> Enviar</button>
      </div>
    </div>
  );
}

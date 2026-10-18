"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Copy, Download, Wallet, X } from "lucide-react";
import QRCode from "qrcode";
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
  const [deposit, setDeposit] = useState(false);
  const [qr, setQr] = useState<string>();
  const address = privy?.wallet?.address ?? privy?.userWallet;
  useEffect(() => {
    if (!deposit || !address) return;
    QRCode.toDataURL(`ethereum:${address}@84532`, { width: 220, margin: 1, color: { dark: "#000000", light: "#f5e400" } }).then(setQr).catch(() => setQr(undefined));
  }, [deposit, address]);

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
          <button type="button" onClick={() => setDeposit(true)} className="inline-flex items-center gap-1.5 rounded-full bg-orbit px-4 py-1.5 text-sm font-semibold text-black hover:brightness-95"><Download className="h-4 w-4" /> Depositar</button>
        ) : privy && !privy.authenticated && PRIVY_APP_ID ? (
          <Button onClick={privy.login}>Entrar con Privy</Button>
        ) : null}
        <button type="button" disabled className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium text-zinc-400 ring-1 ring-inset ring-zinc-600 disabled:opacity-60" title="Los envíos los hace ORBIT por ti; envío manual próximamente"><ArrowUpRight className="h-4 w-4" /> Enviar</button>
      </div>

      {deposit && address ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDeposit(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Depositar USDC</h3>
                <p className="text-xs text-zinc-500">Red Base Sepolia · solo USDC. Es la cuenta de la empresa; de aquí contratas y fondeas a tus agentes.</p>
              </div>
              <button aria-label="Cerrar" className="text-zinc-500 hover:text-white" onClick={() => setDeposit(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-5 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- generated data URL */}
              {qr ? <img src={qr} alt="QR de la dirección" width={176} height={176} className="rounded-xl" /> : <div className="h-44 w-44 animate-pulse rounded-xl bg-panel-2" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Dirección</p>
                <p className="mt-1 break-all font-mono text-sm text-zinc-100">{address}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button onClick={() => void navigator.clipboard.writeText(address)}>Copiar dirección</Button>
                  <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" className="rounded-full px-4 py-1.5 text-sm text-zinc-300 ring-1 ring-inset ring-zinc-600 hover:ring-white">USDC de prueba</a>
                </div>
                <p className="mt-3 text-xs text-zinc-500">Saldo actual: <b className="text-zinc-200">{balance ?? "—"} USDC</b>. Se actualiza solo.</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

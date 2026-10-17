"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { SESSION_COOKIE } from "@/lib/session";

/** Real login for the demo: email, Google or a wallet through Privy. The workspace gate still uses the session cookie. */
export function PrivyLogin() {
  const { ready, authenticated, login, user } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      document.cookie = `${SESSION_COOKIE}=privy; path=/; max-age=86400; samesite=lax`;
      router.push("/app");
    }
  }, [ready, authenticated, router]);

  if (!ready) return <div className="mt-6 h-11 animate-pulse rounded-full bg-panel-2" />;
  return (
    <div className="mt-6 space-y-3">
      <button
        type="button"
        onClick={login}
        disabled={authenticated}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-orbit px-4 py-2.5 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-60"
      >
        {authenticated ? `Entrando como ${user?.email?.address ?? user?.wallet?.address?.slice(0, 8) ?? "…"}` : "Entrar con email, Google o passkey"}
        <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-xs text-zinc-500">Privy crea una wallet para tu empresa al entrar. Con ella activas a los agentes pagando en USDC.</p>
    </div>
  );
}

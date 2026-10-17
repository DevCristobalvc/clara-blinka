"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { PRIVY_APP_ID } from "@/app/providers";
import { SESSION_COOKIE } from "@/lib/session";

/** Who is signed in, and a logout that ends both the Privy session and the workspace cookie. */
export function UserMenu() {
  return PRIVY_APP_ID ? <PrivyUserMenu /> : <DemoUserMenu />;
}

function clearCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
}

function Avatar({ initials }: { initials: string }) {
  return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbit text-[11px] font-bold text-black">{initials}</span>;
}

function PrivyUserMenu() {
  const { ready, authenticated, user, logout } = usePrivy();
  const router = useRouter();
  const label = user?.google?.name ?? user?.email?.address ?? (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}` : undefined);
  const initials = (user?.google?.name ?? user?.email?.address ?? "OR").replace(/@.*/, "").split(/[\s._-]+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  async function signOut() {
    clearCookie();
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  if (!ready) return <span className="h-7 w-7 animate-pulse rounded-full bg-panel-2" />;
  return (
    <div className="flex items-center gap-3">
      <Avatar initials={authenticated ? initials : "DM"} />
      <span className="hidden max-w-[180px] truncate lg:inline" title={label}>{authenticated ? label ?? "Sesión Privy" : "Acceso de demo"}</span>
      <button aria-label="Cerrar sesión" title="Cerrar sesión" className="text-zinc-500 hover:text-white" onClick={signOut}>
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

function DemoUserMenu() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <Avatar initials="DM" />
      <span className="hidden lg:inline">Acceso de demo</span>
      <button aria-label="Cerrar sesión" title="Cerrar sesión" className="text-zinc-500 hover:text-white" onClick={() => { clearCookie(); router.push("/login"); router.refresh(); }}>
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

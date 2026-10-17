"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Bell, ChevronDown, FileText, LayoutGrid, LogOut, Scale, Search, Settings, UserCheck } from "lucide-react";
import { SESSION_COOKIE } from "@/lib/session";
import { OrbitLogo } from "../brand/OrbitLogo";
import { needsPerson, useWorkspace } from "./Workspace";

const NAV = [
  { href: "/app", label: "Panel", icon: LayoutGrid },
  { href: "/app/facturas", label: "Facturas", icon: FileText },
  { href: "/app/reglas", label: "Reglas", icon: Scale },
  { href: "/app/aprobaciones", label: "Aprobaciones", icon: UserCheck },
  { href: "/app/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/app/configuracion", label: "Configuración", icon: Settings },
];

/** The workspace frame from the mockup: sidebar, topbar with search, bell and the demo user. */
export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { cases, query, setQuery, error, setError, info, busy, pagadorActive, agents } = useWorkspace();
  const pending = cases.filter(needsPerson).length;

  return (
    <div className="flex min-h-screen bg-ink">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-[#0a0a0a] p-4 md:flex">
        <Link href="/" aria-label="ORBIT" className="mb-8 mt-1 px-2">
          <OrbitLogo size="md" />
        </Link>
        <nav className="space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-orbit font-semibold text-black" : "text-zinc-400 hover:bg-panel-2 hover:text-white"}`}>
                <Icon className="h-4 w-4" />
                {label}
                {label === "Aprobaciones" && pending ? <span className={`ml-auto rounded-full px-1.5 text-[11px] font-semibold ${active ? "bg-black/20 text-black" : "bg-orbit text-black"}`}>{pending}</span> : null}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto px-2 text-[11px] leading-relaxed text-zinc-600">
          {info ? `${info.store === "supabase" ? "Supabase" : "memoria (efímero)"} · JEV ${info.jev ? "en vivo" : "local"} · ${info.extraction ? "lee PDF/imagen" : "sin extracción"}` : ""}
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/" aria-label="ORBIT"><OrbitLogo size="sm" /></Link>
          </div>
          <label className="flex w-full max-w-md items-center gap-2 rounded-lg border border-line bg-panel-2 px-3 py-2 text-sm text-zinc-400">
            <Search className="h-4 w-4 shrink-0" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar facturas, proveedores…" className="w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" />
          </label>
          <div className="flex items-center gap-4 text-sm text-zinc-300">
            {busy ? <span className="hidden text-xs text-orbit sm:inline">{busy}…</span> : null}
            {agents && !pagadorActive ? <Link href="/app" className="hidden rounded-full border border-orbit/50 px-3 py-1 text-xs text-orbit sm:inline">Paso 1: contrata al pagador</Link> : null}
            <Link href="/app/aprobaciones" className="relative" aria-label="Pendientes de aprobación">
              <Bell className="h-5 w-5" />
              {pending ? <span className="absolute -right-2 -top-2 rounded-full bg-orbit px-1.5 text-[10px] font-bold text-black">{pending}</span> : null}
            </Link>
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbit text-[11px] font-bold text-black">CV</span>
            <span className="hidden lg:inline">Cristobal Valencia</span>
            <ChevronDown className="hidden h-4 w-4 lg:inline" />
            <button
              aria-label="Cerrar sesión"
              className="text-zinc-500 hover:text-white"
              onClick={() => {
                document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`;
                router.push("/");
              }}
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-line px-2 py-1 md:hidden">
          {NAV.map(({ href, label }) => (
            <Link key={href} href={href} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs ${pathname === href ? "bg-orbit font-semibold text-black" : "text-zinc-400"}`}>{label}</Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {error ? (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-sm text-rose-300">
              {error}
              <button onClick={() => setError(undefined)} className="text-xs underline">cerrar</button>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}

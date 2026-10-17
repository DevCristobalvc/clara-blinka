import { ArrowRight, Bell, Check, ChevronDown, Clock, FileText, LayoutGrid, Repeat, Scale, Search, Settings, ShieldCheck, TrendingUp, UserCheck, BarChart3 } from "lucide-react";
import { OrbitLogo } from "@/components/brand/OrbitLogo";

const NAV = [
  { label: "Panel", icon: LayoutGrid, active: true },
  { label: "Facturas", icon: FileText },
  { label: "Reglas", icon: Scale },
  { label: "Aprobaciones", icon: UserCheck },
  { label: "Reportes", icon: BarChart3 },
  { label: "Configuración", icon: Settings },
];

const KPIS = [
  { value: "24", label: "Facturas procesadas", hint: "Este mes", icon: TrendingUp },
  { value: "92%", label: "Decisiones automáticas", icon: Repeat },
  { value: "6", label: "Pendientes de aprobación", icon: Clock, accent: true },
  { value: "0", label: "Pagos fuera de reglas", icon: ShieldCheck },
];

const ROWS = [
  { date: "Hoy, 10:24", vendor: "Acme Solutions", amount: "USD 2,500", status: "Pagada", reason: "Dentro de los límites" },
  { date: "Hoy, 09:17", vendor: "Global Tech Ltd", amount: "USD 8,700", status: "Pendiente", reason: "Monto > límite" },
  { date: "Ayer, 16:32", vendor: "Servicios LATAM", amount: "COP 12,000,000", status: "Pagada", reason: "Proveedor permitido" },
];

/** Static product preview for the landing page ("Cómo funciona"), mirroring the mockup's dashboard. */
export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-700/80 bg-[#0a0a0a] text-left shadow-[0_0_60px_rgba(245,228,0,0.08)]">
      <div className="flex">
        <aside className="hidden w-[130px] shrink-0 border-r border-line p-3 sm:block">
          <div className="mb-6 mt-2 px-1">
            <OrbitLogo size="sm" />
          </div>
          <ul className="space-y-1">
            {NAV.map(({ label, icon: Icon, active }) => (
              <li key={label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${active ? "bg-orbit font-semibold text-black" : "text-zinc-400"}`}>
                <Icon className="h-3 w-3" /> {label}
              </li>
            ))}
          </ul>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex w-full max-w-[260px] items-center gap-2 rounded-md border border-line bg-panel px-2 py-1.5 text-[10px] text-zinc-500">
              <Search className="h-3 w-3" /> Buscar facturas, proveedores...
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-300">
              <Bell className="h-3.5 w-3.5" />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orbit text-[8px] font-bold text-black">CV</span>
              <span className="hidden md:inline">Cristobal Valencia</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold">Resumen ejecutivo</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {KPIS.map(({ value, label, hint, icon: Icon, accent }) => (
                <div key={label} className="rounded-lg border border-line bg-panel p-3">
                  <div className="flex items-start justify-between">
                    <span className={`text-xl font-bold ${accent ? "text-orbit" : "text-white"}`}>{value}</span>
                    <Icon className="h-3.5 w-3.5 text-orbit" />
                  </div>
                  <p className="mt-2 text-[9px] leading-tight text-zinc-300">{label}</p>
                  {hint ? <p className="text-[9px] text-zinc-500">{hint}</p> : null}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-line bg-panel">
              <div className="flex items-center justify-between px-3 py-2.5">
                <p className="text-[11px] font-semibold">Actividad reciente</p>
                <p className="flex items-center gap-1 text-[9px] font-semibold text-orbit">
                  Ver todas <ArrowRight className="h-2.5 w-2.5" />
                </p>
              </div>
              <table className="w-full text-[9px]">
                <thead className="bg-white/[0.03] text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="text-left font-medium">Proveedor</th>
                    <th className="text-left font-medium">Monto</th>
                    <th className="text-left font-medium">Decisión</th>
                    <th className="hidden text-left font-medium md:table-cell">Razón</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-zinc-200">
                  {ROWS.map((r) => (
                    <tr key={r.vendor}>
                      <td className="px-3 py-2">{r.date}</td>
                      <td>{r.vendor}</td>
                      <td className="whitespace-nowrap pr-2">{r.amount}</td>
                      <td>
                        {r.status === "Pagada" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                            <Check className="h-2.5 w-2.5" /> Pagada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-orbit/40 bg-orbit/15 px-2 py-0.5 text-orbit">
                            <Clock className="h-2.5 w-2.5" /> Pendiente
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

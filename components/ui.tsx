import type { Action, ReasonCode } from "@/lib/engine/types";
import { ACTION_LABEL, REASON_LABEL } from "@/lib/client/store";

export const ACTION_STYLE: Record<Action, { badge: string; column: string; dot: string }> = {
  PAY: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", column: "border-emerald-200 bg-emerald-50/40", dot: "bg-emerald-500" },
  HOLD: { badge: "bg-rose-50 text-rose-700 ring-rose-600/20", column: "border-rose-200 bg-rose-50/40", dot: "bg-rose-500" },
  ESCALATE: { badge: "bg-amber-50 text-amber-800 ring-amber-600/20", column: "border-amber-200 bg-amber-50/40", dot: "bg-amber-500" },
};

export function ActionBadge({ action }: { action: Action }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ACTION_STYLE[action].badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ACTION_STYLE[action].dot}`} />
      {ACTION_LABEL[action]}
    </span>
  );
}

export function ReasonChip({ code }: { code: ReasonCode }) {
  return <span className="inline-block rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700">{REASON_LABEL[code]}</span>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const styles = {
    primary: "bg-zinc-900 text-white hover:bg-zinc-700",
    secondary: "bg-white text-zinc-900 ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    ghost: "text-zinc-600 hover:bg-zinc-100",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function ProbabilityBar({ value, danger = false }: { value: number; danger?: boolean }) {
  const pct = Math.round(value * 100);
  const color = danger ? (pct >= 70 ? "bg-rose-500" : "bg-zinc-400") : pct >= 50 ? "bg-emerald-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-zinc-600">{pct}%</span>
    </div>
  );
}

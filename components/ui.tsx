import type { Action, ReasonCode } from "@/lib/engine/types";
import { ACTION_LABEL, REASON_LABEL } from "@/lib/client/store";

export const ACTION_STYLE: Record<Action, { badge: string; column: string; dot: string }> = {
  PAY: { badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30", column: "border-emerald-500/25 bg-emerald-500/[0.04]", dot: "bg-emerald-500" },
  HOLD: { badge: "bg-rose-500/15 text-rose-300 ring-rose-500/30", column: "border-rose-500/25 bg-rose-500/[0.04]", dot: "bg-rose-500" },
  ESCALATE: { badge: "bg-orbit/15 text-orbit ring-orbit/40", column: "border-orbit/25 bg-orbit/[0.04]", dot: "bg-orbit" },
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
  return <span className="inline-block rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">{REASON_LABEL[code]}</span>;
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
    primary: "bg-orbit text-black font-semibold hover:brightness-95",
    secondary: "bg-transparent text-white ring-1 ring-inset ring-zinc-600 hover:ring-white",
    danger: "bg-rose-600 text-white hover:bg-rose-500",
    ghost: "text-zinc-400 hover:bg-panel-2 hover:text-white",
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`rounded-full px-4 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}>
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-panel p-5 ${className}`}>{children}</div>;
}

export function ProbabilityBar({ value, danger = false }: { value: number; danger?: boolean }) {
  const pct = Math.round(value * 100);
  const color = danger ? (pct >= 70 ? "bg-rose-500" : "bg-zinc-400") : pct >= 50 ? "bg-emerald-500" : "bg-orbit";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-xs text-zinc-400">{pct}%</span>
    </div>
  );
}

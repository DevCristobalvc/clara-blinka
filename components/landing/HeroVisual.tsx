import { ArrowRight, Check, ReceiptText } from "lucide-react";

/** Robot orb in orbit with the floating invoice and decision cards (CSS/SVG version of the mockup art). */
export function HeroVisual() {
  return (
    <div className="relative mx-auto h-[420px] w-full max-w-[600px]" aria-hidden>
      {/* thin orbit lines */}
      <svg viewBox="0 0 600 420" className="absolute inset-0 h-full w-full" fill="none">
        <ellipse cx="330" cy="190" rx="290" ry="120" transform="rotate(-32 330 190)" stroke="#F5E400" strokeOpacity="0.35" strokeWidth="1" />
        <ellipse cx="330" cy="190" rx="250" ry="160" transform="rotate(28 330 190)" stroke="#F5E400" strokeOpacity="0.18" strokeWidth="1" />
      </svg>

      {/* glow behind the orb */}
      <div className="absolute left-[330px] top-[185px] h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orbit/20 blur-3xl" />

      {/* orb */}
      <div className="absolute left-[330px] top-[180px] h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_30%_25%,#ffffff_0%,#d4d4d4_18%,#6b6b6b_42%,#1a1a1a_72%)] shadow-[inset_0_0_30px_rgba(255,255,255,0.25),0_0_60px_rgba(245,228,0,0.35)]">
        <div className="absolute inset-[18px] rounded-full bg-[radial-gradient(circle_at_50%_40%,#141414,#000_75%)] shadow-[inset_0_0_25px_rgba(245,228,0,0.25)]">
          <div className="absolute left-[46px] top-[52px] h-[56px] w-[24px] rounded-full bg-orbit shadow-[0_0_24px_rgba(245,228,0,0.9)]" />
          <div className="absolute right-[46px] top-[52px] h-[56px] w-[24px] rounded-full bg-orbit shadow-[0_0_24px_rgba(245,228,0,0.9)]" />
        </div>
      </div>

      {/* main ring around the orb */}
      <svg viewBox="0 0 600 420" className="absolute inset-0 h-full w-full drop-shadow-[0_0_10px_rgba(245,228,0,0.8)]" fill="none">
        <ellipse cx="330" cy="185" rx="215" ry="72" transform="rotate(-14 330 185)" stroke="#F5E400" strokeWidth="4" />
      </svg>

      {/* invoice card */}
      <div className="absolute left-[24px] top-[20px] w-[190px] -rotate-[9deg] rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800">
            <ReceiptText className="h-5 w-5 text-zinc-200" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Factura #1032</p>
            <p className="text-[11px] text-zinc-400">Acme Solutions</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-zinc-200">USD 2,500</p>
        <span className="mt-2 inline-block rounded-full bg-orbit px-3 py-1 text-[11px] font-semibold text-black">Analizando...</span>
      </div>

      {/* decision card */}
      <div className="absolute bottom-[40px] right-0 w-[200px] rounded-2xl border border-orbit/40 bg-black/70 p-4 text-left backdrop-blur-md">
        <p className="text-xs font-semibold text-white">Decisión del agente</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500">
            <Check className="h-4 w-4 text-black" strokeWidth={3} />
          </span>
          <span className="text-lg font-semibold text-white">Pagar</span>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">Dentro de las reglas de la empresa</p>
        <p className="mt-3 flex items-center gap-1 text-[11px] font-semibold text-orbit">
          Ver detalle <ArrowRight className="h-3 w-3" />
        </p>
      </div>
    </div>
  );
}

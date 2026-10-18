"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Link2 } from "lucide-react";
import { OrbitLogo } from "./brand/OrbitLogo";

const TEAM = [
  {
    name: "Cristobal Valencia Cerón",
    role: "AI Engineer · producto, pitch y despliegue",
    org: "BIP · Ekinoxis",
    linkedin: "https://www.linkedin.com/in/cristobalvalenciaceron/",
    photo: "/team/cristobal.png",
    initials: "CV",
  },
  {
    name: "William Martínez",
    role: "Founder, economista y product manager · agentes, pagos y datos",
    org: "Ekinoxis · Convexo",
    linkedin: "https://www.linkedin.com/in/williammartinez8/",
    photo: "/team/william.png",
    initials: "WM",
  },
];

const SLIDES = [
  { id: "title", kicker: "30X Hackathon · Reto Blinka", title: "Actúa con autonomía. Nunca sin límites." },
  { id: "problem", kicker: "El problema", title: "Pagar a proveedores en Latinoamérica es manual, cada mes, y depende de una persona." },
  { id: "team", kicker: "El equipo", title: "Dos personas, un fin de semana." },
  { id: "built", kicker: "Qué construimos", title: "Agentes que pagan y cobran por tu empresa." },
  { id: "results", kicker: "Resultados", title: "21 facturas. 12 trampas. 0 pagos fuera de las reglas." },
  { id: "next", kicker: "Qué sigue", title: "Del pagador al cobrador, y de agentes a agentes." },
] as const;

export function Deck() {
  const index = Number(useSearchParams().get("s") ?? 0);
  const [i, setI] = useState(Math.min(Math.max(Number.isFinite(index) ? index : 0, 0), SLIDES.length - 1));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") setI((v) => Math.min(v + 1, SLIDES.length - 1));
      if (e.key === "ArrowLeft") setI((v) => Math.max(v - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const slide = SLIDES[i];

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-black text-white">
      <div aria-hidden className="pointer-events-none absolute -bottom-[520px] left-1/2 h-[700px] w-[1600px] -translate-x-1/2 rounded-[50%] border-t-2 border-orbit/70 bg-[radial-gradient(ellipse_at_top,rgba(245,228,0,0.16),transparent_60%)] shadow-[0_-30px_140px_rgba(245,228,0,0.22)]" />
      <header className="relative z-10 flex items-center justify-between px-10 py-7">
        <Link href="/"><OrbitLogo size="lg" /></Link>
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{i + 1} / {SLIDES.length}</p>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-10 pb-20">
        <p className="text-base font-semibold uppercase tracking-[0.25em] text-orbit">{slide.kicker}</p>
        <h1 className="mt-4 max-w-5xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl">{slide.title}</h1>

        {slide.id === "title" ? (
          <p className="mt-8 max-w-3xl text-2xl text-zinc-300">ORBIT: la plataforma donde tus agentes de IA cobran y pagan por tu empresa, dentro de las reglas que tú defines.</p>
        ) : null}

        {slide.id === "problem" ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              ["Llegan", "Facturas por correo, PDF o chat. Alguien las compara con lo acordado."],
              ["Se persiguen", "Cuando algo no cuadra: escribir al proveedor, pedir aprobación por chat."],
              ["Se pagan a mano", "En otra moneda, hacia otro país. Y se concilia en una hoja de cálculo."],
            ].map(([h, t]) => (
              <li key={h} className="rounded-2xl border border-line bg-panel/80 p-6">
                <p className="text-2xl font-semibold text-orbit">{h}</p>
                <p className="mt-2 text-xl text-zinc-200">{t}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {slide.id === "team" ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {TEAM.map((m) => (
              <a key={m.name} href={m.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-6 rounded-2xl border border-line bg-panel/80 p-6 transition hover:border-orbit/60">
                <Avatar src={m.photo} initials={m.initials} />
                <div className="min-w-0">
                  <p className="text-3xl font-semibold">{m.name}</p>
                  <p className="mt-2 text-lg text-zinc-300">{m.role}</p>
                  <p className="text-lg text-zinc-500">{m.org}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-base text-orbit"><Link2 className="h-4 w-4" /> {m.linkedin.replace("https://www.", "")}</p>
                </div>
              </a>
            ))}
          </div>
        ) : null}

        {slide.id === "built" ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              ["Pagador", "Lee cada factura, la revisa contra las reglas y decide: pagar, frenar o escalar. Las seis correctas se pagan solas."],
              ["Negocia", "Cuando algo no cuadra, le escribe al proveedor en un enlace por pago, consigue la corrección y la vuelve a pasar por las mismas reglas."],
              ["Se contrata pagando", "La empresa activa y fondea a sus agentes en USDC (x402), desde su propia wallet. Sin cuenta, sin tarjeta."],
              ["Se puede verificar", "Cada decisión queda firmada con las reglas vigentes; webhooks firmados a los sistemas de la empresa."],
            ].map(([h, t]) => (
              <li key={h} className="rounded-2xl border border-line bg-panel/80 p-5">
                <p className="text-2xl font-semibold text-orbit">{h}</p>
                <p className="mt-2 text-lg text-zinc-200">{t}</p>
              </li>
            ))}
          </ul>
        ) : null}

        {slide.id === "results" ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-4">
            {[
              ["100%", "precisión", "21 de 21 decisiones iguales a lo esperado"],
              ["0 · 0", "pagos fuera de reglas", "antes y después de negociar"],
              ["76%", "autonomía", "decididas bien sin una persona"],
              ["3 / 10", "resueltas con el proveedor", "frenadas cerradas sin una persona"],
            ].map(([v, l, h]) => (
              <div key={l} className="rounded-2xl border border-line bg-panel/80 p-6">
                <p className="text-5xl font-bold text-orbit">{v}</p>
                <p className="mt-3 text-xl font-medium">{l}</p>
                <p className="mt-1 text-sm text-zinc-500">{h}</p>
              </div>
            ))}
          </div>
        ) : null}

        {slide.id === "next" ? (
          <ul className="mt-10 space-y-4 text-2xl text-zinc-200">
            {[
              "El cobrador: el mismo motor con las reglas invertidas, para lo que te deben.",
              "Agentes pagándole a agentes: el agente de la empresa paga por caso con x402.",
              "Negociar sin revelar límites: pruebas en lugar de confianza (ZK / FHE).",
              "Sobre los rieles de Blinka, con JEV como capa de juicio rápido.",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3"><ArrowRight className="mt-2 h-5 w-5 shrink-0 text-orbit" /> {t}</li>
            ))}
          </ul>
        ) : null}
      </section>

      <footer className="relative z-10 flex items-center justify-between px-10 py-6 text-xs text-zinc-500">
        <span>orbit.ekinoxis.xyz · github.com/DevCristobalvc/orbit</span>
        <span className="flex gap-1">
          {SLIDES.map((s, k) => (
            <button key={s.id} aria-label={s.kicker} onClick={() => setI(k)} className={`h-1.5 w-6 rounded-full ${k === i ? "bg-orbit" : "bg-zinc-700"}`} />
          ))}
        </span>
      </footer>
    </main>
  );
}

function Avatar({ src, initials }: { src: string; initials: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-full bg-orbit text-4xl font-bold text-black">{initials}</div>;
  // eslint-disable-next-line @next/next/no-img-element -- static team photo in public/
  return <img src={src} alt="" onError={() => setBroken(true)} className="h-40 w-40 shrink-0 rounded-full object-cover ring-2 ring-orbit/60" />;
}

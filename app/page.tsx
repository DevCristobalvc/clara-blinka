import Link from "next/link";
import { ArrowRight, BarChart3, ChevronDown, Play, Rocket, ShieldCheck, Zap } from "lucide-react";
import { OrbitLogo } from "@/components/brand/OrbitLogo";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { HeroVisual } from "@/components/landing/HeroVisual";

const REPO_URL = "https://github.com/DevCristobalvc/clara-blinka";

const NAV_LINKS = [
  { label: "Beneficios", href: "#beneficios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Seguridad", href: "#beneficios" },
  { label: "Precios", href: "#empezar" },
];

const STEPS = [
  { title: "Recibe", text: "Analiza facturas desde email, PDF o chat." },
  { title: "Razona", text: "Aplica las reglas de tu empresa." },
  { title: "Decide", text: "Paga, frena o escala según corresponda." },
  { title: "Registra", text: "Documenta cada decisión con su explicación." },
];

const BENEFITS = [
  { icon: Zap, title: "Automatización inteligente", text: "Delega tareas repetitivas y enfócate en lo estratégico." },
  { icon: ShieldCheck, title: "Cumplimiento por diseño", text: "El agente siempre actúa dentro de tus reglas." },
  { icon: BarChart3, title: "Visibilidad total", text: "Consulta el historial, entiende cada decisión." },
  { icon: Rocket, title: "Escalabilidad real", text: "Gestiona más volumen, con la misma confianza." },
];

function YellowButton({ href, children, small = false }: { href: string; children: React.ReactNode; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full bg-orbit font-semibold text-black transition hover:brightness-95 ${small ? "px-4 py-2 text-xs" : "px-6 py-3 text-sm"}`}
    >
      {children}
    </Link>
  );
}

export default function Landing() {
  return (
    <div className="relative overflow-x-hidden bg-black text-white">
      {/* Navbar */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-6 sm:px-8">
        <Link href="/" aria-label="ORBIT">
          <OrbitLogo size="lg" />
        </Link>
        <nav className="hidden items-center gap-10 text-sm text-zinc-200 lg:flex">
          <a href="#como-funciona" className="flex items-center gap-1 hover:text-white">
            Producto <ChevronDown className="h-3.5 w-3.5" />
          </a>
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden rounded-full border border-zinc-500 px-5 py-2 text-sm font-medium hover:border-white sm:inline-block">
            Iniciar sesión
          </Link>
          <Link href="/login" className="rounded-full bg-orbit px-5 py-2 text-sm font-semibold text-black hover:brightness-95">
            Comenzar gratis
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        {/* planet horizon glow */}
        <div aria-hidden className="pointer-events-none absolute -bottom-[560px] left-[38%] h-[700px] w-[1300px] rounded-[50%] border-t-[3px] border-orbit/90 bg-[radial-gradient(ellipse_at_top,rgba(245,228,0,0.22),transparent_55%)] shadow-[0_-25px_100px_rgba(245,228,0,0.35)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-16 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl xl:text-[52px] xl:whitespace-nowrap">
              Actúa con autonomía.
              <br />
              <span className="text-orbit">Nunca sin límites.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-zinc-200">
              La plataforma donde tus agentes de IA gestionan pagos, revisan facturas y toman decisiones, siempre bajo las reglas de tu empresa.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <YellowButton href="/login">
                Comenzar gratis <ArrowRight className="h-4 w-4" />
              </YellowButton>
              <a href="#como-funciona" className="inline-flex items-center gap-3 rounded-full border border-zinc-400 px-6 py-3 text-sm font-semibold hover:border-white">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white">
                  <Play className="h-2.5 w-2.5 fill-black text-black" />
                </span>
                Ver cómo funciona
              </a>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-xs text-zinc-200">
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Seguro y auditable
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orbit" /> Autónomo, pero controlado
              </li>
              <li className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orbit" /> Decisiones explicables
              </li>
            </ul>
          </div>
          <div className="hidden md:block">
            <HeroVisual />
          </div>
        </div>
      </section>

      <div className="relative z-10 border-t border-zinc-800 bg-black">
        {/* Cómo funciona */}
        <section id="como-funciona" className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orbit">Cómo funciona</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
              Un agente que <span className="text-orbit">piensa,</span>
              <br />
              <span className="text-orbit">decide y actúa.</span>
            </h2>
            <p className="mt-5 max-w-sm text-zinc-200">Configura tus reglas, y deja que ORBIT se encargue del resto.</p>
            <ol className="relative mt-8 space-y-6">
              <span aria-hidden className="absolute bottom-4 left-[15px] top-4 w-px bg-zinc-700" />
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative flex gap-5">
                  <span className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-orbit bg-black text-sm font-bold text-orbit">{i + 1}</span>
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-zinc-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative">
            <svg aria-hidden viewBox="0 0 200 600" className="pointer-events-none absolute -left-16 top-1/2 h-[560px] w-[190px] -translate-y-1/2 drop-shadow-[0_0_14px_rgba(245,228,0,0.7)]" fill="none">
              <path d="M190 10 C 40 120, 20 480, 190 590" stroke="#F5E400" strokeOpacity="0.85" strokeWidth="2.5" />
            </svg>
            <div className="relative">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* Beneficios */}
        <section id="beneficios" className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-[0.8fr_2.2fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-orbit">Beneficios</p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight">
              Más control. Mayor <span className="text-orbit">productividad.</span>
            </h2>
            <p className="mt-4 text-zinc-200">Una plataforma diseñada para empresas que quieren escalar su operación con IA, sin perder el control.</p>
            <div className="mt-6">
              <YellowButton href="/login" small>
                Explorar beneficios <ArrowRight className="h-3.5 w-3.5" />
              </YellowButton>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-zinc-800 bg-[#0c0c0c] p-6">
                <Icon className="h-8 w-8 text-orbit" strokeWidth={2.2} />
                <h3 className="mt-6 text-lg font-bold leading-snug">{title}</h3>
                <p className="mt-3 text-sm text-zinc-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section id="empezar" className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-orbit/50 px-6 py-14 text-center">
            <div aria-hidden className="pointer-events-none absolute -left-40 -bottom-56 h-[360px] w-[620px] rounded-[50%] border-t-2 border-orbit bg-[radial-gradient(ellipse_at_top,rgba(245,228,0,0.35),transparent_60%)] shadow-[0_-20px_80px_rgba(245,228,0,0.4)]" />
            <div aria-hidden className="pointer-events-none absolute -right-72 -top-64 h-[360px] w-[620px] rounded-[50%] border-b-2 border-orbit/70 shadow-[0_20px_80px_rgba(245,228,0,0.25)]" />
            <div aria-hidden className="pointer-events-none absolute left-[12%] top-[30%] h-1 w-1 rounded-full bg-white/70" />
            <div aria-hidden className="pointer-events-none absolute left-[22%] top-[65%] h-0.5 w-0.5 rounded-full bg-white/60" />
            <div aria-hidden className="pointer-events-none absolute right-[18%] top-[70%] h-1 w-1 rounded-full bg-white/50" />
            <div className="relative">
              <h2 className="text-2xl font-extrabold tracking-tight text-orbit sm:text-3xl">El futuro de la gestión financiera es agentico.</h2>
              <p className="mt-3 text-zinc-100">Construye, corre y escala agentes que actúan por tu empresa.</p>
              <div className="mt-7">
                <YellowButton href="/login">
                  Comenzar ahora <ArrowRight className="h-4 w-4" />
                </YellowButton>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-10 sm:px-8">
          <OrbitLogo size="lg" />
          <nav className="flex flex-wrap gap-10 text-sm text-zinc-200">
            <a href="#como-funciona" className="hover:text-white">Producto</a>
            <a href="#beneficios" className="hover:text-white">Seguridad</a>
            <a href={REPO_URL} className="hover:text-white">Recursos</a>
            <a href={`${REPO_URL}/issues`} className="hover:text-white">Soporte</a>
          </nav>
          <div className="flex items-center gap-5 text-sm text-zinc-300">
            <span>Built for the agentic era.</span>
            <SocialIcons />
          </div>
        </footer>
      </div>
    </div>
  );
}

function SocialIcons() {
  return (
    <span className="flex items-center gap-3 text-zinc-300">
      <a href="https://www.linkedin.com" aria-label="LinkedIn" className="hover:text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.8-2 4 0 4.8 2.6 4.8 6V21h-4v-5.5c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4V9Z" /></svg>
      </a>
      <a href={REPO_URL} aria-label="GitHub" className="hover:text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.64 22.4c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>
      </a>
      <a href="https://www.youtube.com" aria-label="YouTube" className="hover:text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z" /></svg>
      </a>
    </span>
  );
}

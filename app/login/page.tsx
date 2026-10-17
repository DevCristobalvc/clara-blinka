import Link from "next/link";
import { OrbitLogo } from "@/components/brand/OrbitLogo";
import { LoginForm } from "@/components/LoginForm";

export const metadata = { title: "Iniciar sesión · ORBIT" };

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div aria-hidden className="pointer-events-none absolute -bottom-[460px] left-1/2 h-[600px] w-[1400px] -translate-x-1/2 rounded-[50%] border-t-2 border-orbit/70 bg-[radial-gradient(ellipse_at_top,rgba(245,228,0,0.18),transparent_60%)] shadow-[0_-30px_120px_rgba(245,228,0,0.25)]" />
      <div className="relative w-full max-w-sm">
        <Link href="/" className="mb-8 flex justify-center">
          <OrbitLogo size="lg" />
        </Link>
        <div className="rounded-2xl border border-line bg-panel/90 p-7 backdrop-blur">
          <h1 className="text-2xl font-bold tracking-tight">Iniciar sesión</h1>
          <p className="mt-1 text-sm text-zinc-400">Entra al espacio de trabajo de tu agente.</p>
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-zinc-500">
          Demo del hackathon · usuario <span className="font-mono text-zinc-300">123</span> · contraseña <span className="font-mono text-zinc-300">123</span>
        </p>
      </div>
    </main>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SESSION_COOKIE, isDemoLogin } from "@/lib/session";

export function LoginForm() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isDemoLogin(user, password)) {
      setError(true);
      return;
    }
    document.cookie = `${SESSION_COOKIE}=demo; path=/; max-age=86400; samesite=lax`;
    router.push("/app");
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block text-xs font-medium text-zinc-400">
        Usuario
        <input
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
          className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orbit"
        />
      </label>
      <label className="block text-xs font-medium text-zinc-400">
        Contraseña
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-orbit"
        />
      </label>
      {error ? <p className="text-sm text-rose-400">Usuario o contraseña incorrectos.</p> : null}
      <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-full bg-orbit py-2.5 text-sm font-semibold text-black transition hover:brightness-95">
        Entrar <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}

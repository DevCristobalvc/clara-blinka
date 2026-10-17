/** ORBIT mark: an open orbit ring with a planet in the gap and a core, in neon yellow. */
export function OrbitMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <path d="M26.5 11.5A11.5 11.5 0 1 1 20.5 5.4" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="25" cy="7" r="2.6" fill="currentColor" />
      <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  );
}

export function OrbitLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const mark = { sm: "h-5 w-5", md: "h-7 w-7", lg: "h-9 w-9" }[size];
  const text = { sm: "text-base", md: "text-xl", lg: "text-2xl" }[size];
  return (
    <span className="inline-flex items-center gap-2.5 text-orbit">
      <OrbitMark className={mark} />
      <span className={`${text} font-semibold tracking-[0.18em] text-white`}>ORBIT</span>
    </span>
  );
}

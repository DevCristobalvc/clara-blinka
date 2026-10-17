import { Suspense } from "react";
import { FacturasView } from "@/components/app/FacturasView";

export const metadata = { title: "Facturas · ORBIT" };

export default function FacturasPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Cargando…</p>}>
      <FacturasView />
    </Suspense>
  );
}

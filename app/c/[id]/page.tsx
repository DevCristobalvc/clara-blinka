import { Suspense } from "react";
import { CasePage } from "@/components/CasePage";

export const metadata = { title: "Caso de pago · ORBIT" };

/** Public link for one payment: the vendor (or its cobrador agent) submits the invoice and talks to ORBIT here. */
export default function CaseRoute({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Cargando el caso…</p>}>
        <CaseLoader params={params} />
      </Suspense>
    </main>
  );
}

async function CaseLoader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CasePage id={id} />;
}

"use client";

import { useEffect, useState } from "react";
import type { Company } from "@/lib/engine/types";
import { RulesEditor } from "../RulesEditor";
import { Button } from "../ui";
import { useWorkspace } from "./Workspace";

/** Edit the rules as a draft, then save to the server: from then on every case is decided with them. */
export function ReglasView() {
  const { company, savePolicy, run, busy } = useWorkspace();
  const [draft, setDraft] = useState<Company>();
  const dirty = Boolean(draft && company && JSON.stringify(draft) !== JSON.stringify(company));

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- take the server copy as the draft until the user edits
    if (company && !dirty) setDraft(company);
  }, [company, dirty]);

  if (!draft) return <p className="text-sm text-zinc-500">Cargando las reglas…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Reglas</h1>
          <p className="text-xs text-zinc-500">Esto es lo único que el agente nunca cambia por su cuenta. Cada decisión queda firmada con el hash de las reglas vigentes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!dirty || Boolean(busy)} onClick={() => setDraft(company)}>Descartar</Button>
          <Button disabled={!dirty || Boolean(busy)} onClick={() => run("guardando reglas", async () => { await savePolicy(draft); })}>{dirty ? "Guardar reglas" : "Reglas guardadas"}</Button>
        </div>
      </div>
      <RulesEditor company={draft} onChange={setDraft} />
    </div>
  );
}

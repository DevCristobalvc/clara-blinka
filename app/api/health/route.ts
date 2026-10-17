import { connection } from "next/server";
import { signingKeys } from "@/lib/engine/receipt";
import { handle, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

/** What this deployment can do, so the UI can label ephemeral storage, offline judgments and unsigned receipts. */
export async function GET() {
  await connection(); // request time, never prerendered
  return handle(async () =>
    json({
      store: getStore().kind,
      extraction: Boolean(process.env.ANTHROPIC_API_KEY),
      jev: Boolean(process.env.TYPESAFE_API_KEY),
      signingKey: signingKeys().ephemeral ? "ephemeral" : "configured",
    }),
  );
}

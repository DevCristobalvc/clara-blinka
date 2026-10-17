import { COMPANY_ID, handle, json } from "@/lib/server/http";
import { seedCompany } from "@/lib/server/seed";
import { getStore } from "@/lib/server/store";

/** Demo reset: drop every case and event, re-seed the company, keep the webhook config and agent activations. */
export async function POST(request: Request) {
  return handle(async () => {
    const full = new URL(request.url).searchParams.get("full") === "1"; // also forget agent activations
    const store = getStore();
    const current = await store.getCompany(COMPANY_ID);
    await store.reset(COMPANY_ID);
    await store.putCompany({ ...seedCompany(), webhook: current?.webhook ?? {}, agents: full ? undefined : current?.agents });
    return json({ ok: true });
  });
}

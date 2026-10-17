import { extractInvoice } from "@/lib/engine/extract";
import { sourceFromForm } from "@/lib/server/invoice-source";

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "Extraction is not configured (missing ANTHROPIC_API_KEY)" }, { status: 503 });
  }
  try {
    const source = await sourceFromForm(await request.formData());
    return Response.json(await extractInvoice(source));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}

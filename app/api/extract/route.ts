import { extractInvoice, type InvoiceSource } from "@/lib/engine/extract";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

async function sourceFromForm(form: FormData): Promise<InvoiceSource> {
  const file = form.get("file");
  const text = form.get("text");
  if (typeof text === "string" && text.trim()) {
    const channel = (form.get("channel") as "email" | "chat" | "text" | null) ?? "text";
    return { kind: "text", text, channel };
  }
  if (!(file instanceof File)) throw new Error("Send a file or text");
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    return { kind: "pdf", base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
  }
  if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { kind: "image", base64: Buffer.from(await file.arrayBuffer()).toString("base64"), mediaType: file.type as ImageType };
  }
  const channel = name.endsWith(".eml") ? "email" : name.includes("chat") ? "chat" : "text";
  return { kind: "text", text: await file.text(), channel };
}

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

import type { Beneficiary, Case, Company } from "@/lib/engine/types";
import { matchBeneficiary } from "@/lib/engine/rules";
import type { CaseStore } from "./store";

/**
 * Sending the case link to the vendor. With RESEND_API_KEY it goes out as an email; without it the
 * send is recorded (the demo shows the same thing). Either way the case remembers who got the link.
 */

/** The vendor's address: the registered one, or a stable fictitious one derived from the name (demo set). */
export function vendorEmail(b: Beneficiary): string {
  if (b.email) return b.email;
  const slug = b.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]+/g, ".")
    .replace(/^\.|\.$/g, "");
  return `${slug}@example.com`;
}

export function resolveVendor(c: Case, company: Company): Beneficiary | undefined {
  if (c.vendorHint?.beneficiaryId) return company.beneficiaries.find((b) => b.id === c.vendorHint!.beneficiaryId);
  if (c.vendorHint?.name) return matchBeneficiary({ payeeName: c.vendorHint.name, invoiceNumber: "", currency: "USD", amount: 0, concept: "" }, company.beneficiaries).beneficiary;
  return undefined;
}

async function deliver(to: string, company: Company, link: string): Promise<"email" | "recorded"> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return "recorded";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ORBIT_EMAIL_FROM ?? "ORBIT <onboarding@resend.dev>",
      to: [to],
      subject: `${company.company.name}: enlace para tu factura`,
      text: `Hola,\n\n${company.company.name} usa ORBIT para pagar a sus proveedores. Adjunta tu factura en este enlace y el agente de pagos te responde ahí mismo:\n\n${link}\n\nSi algo no cuadra con lo acordado, te lo dirá y podrás corregirlo en el mismo enlace.\n\nORBIT, agente de pagos de ${company.company.name}`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return "email";
}

/** Send (or record) the link to the case's vendor and remember it on the case. Returns the updated case. */
export async function sendInvite(store: CaseStore, company: Company, c: Case, link: string): Promise<Case> {
  const vendor = resolveVendor(c, company);
  if (!vendor) return c;
  const email = vendorEmail(vendor);
  let delivery: "email" | "recorded" = "recorded";
  try {
    delivery = await deliver(email, company, link);
  } catch (err) {
    console.error("[invite] email failed, recorded instead:", (err as Error).message);
  }
  c.invite = { email, sentAt: new Date().toISOString(), delivery };
  await store.appendEvent({ caseId: c.id, companyId: c.companyId, type: "link.sent", payload: { email, delivery, link } });
  return store.updateCase(c);
}

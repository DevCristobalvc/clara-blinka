import type { PaymentExecutor, Settlement } from "./types";

/**
 * The step after a PAY decision. The challenge ends at the decision, so ORBIT only records the
 * payment in its ledger; moving the money is out of scope. A real rail would implement the same interface.
 */
export class LedgerExecutor implements PaymentExecutor {
  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  async execute(): Promise<Settlement> {
    const hex = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("");
    return { ref: `pago-${hex}`, rail: "ledger", at: this.now(), note: "Decisión registrada en el libro de pagos. La ejecución del pago queda fuera del alcance de ORBIT." };
  }
}

/** @deprecated name kept for older imports */
export { LedgerExecutor as MockExecutor };

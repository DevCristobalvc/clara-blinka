// Static demo rates (units per 1 USD). Real FX is out of scope for the challenge.
export const FX_PER_USD: Record<string, number> = {
  USD: 1,
  COP: 4000,
  MXN: 18,
  BRL: 5.5,
  ARS: 1400,
  // Not an allowed payment currency; present so a EUR invoice can be compared with its reissue.
  EUR: 0.92,
};

export function toUSD(amount: number, currency: string): number {
  const rate = FX_PER_USD[currency.toUpperCase()];
  if (!rate) return NaN;
  return Math.round((amount / rate) * 100) / 100;
}

export function fmtMoney(amount: number, currency: string) {
  return `${amount.toLocaleString("es-CO", { maximumFractionDigits: 2 })} ${currency}`;
}

export function fmtUSD(amount: number) {
  return `USD ${amount.toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function fmtWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Hoy, ${time}` : `${d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}, ${time}`;
}

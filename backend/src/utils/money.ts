export function formatCents(cents: number, currency = 'USD'): string {
  const symbol = currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function toCents(input: number): number {
  return Math.round(input * 100);
}

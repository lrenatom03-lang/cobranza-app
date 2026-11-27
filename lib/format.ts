import type { Currency } from './types';

export function fmtMoney(amount: number, currency: Currency): string {
  const n = amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency === 'PEN' ? `S/ ${n}` : `US$ ${n}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function fmtPEN(n: number): string {
  return `S/ ${n.toLocaleString('es-PE', { maximumFractionDigits: 0 })}`;
}

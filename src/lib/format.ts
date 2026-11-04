const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });

export function fmtUsd(v: number, opts: { compact?: boolean; sign?: boolean } = {}): string {
  if (!Number.isFinite(v)) return '—';
  const s = opts.compact && Math.abs(v) >= 100_000 ? usdCompact.format(Math.abs(v)) : usdFmt.format(Math.abs(v));
  const neg = v < 0 && Math.abs(v) >= 0.005;
  if (neg) return `−${s}`;
  return opts.sign && v > 0 ? `+${s}` : s;
}

export function fmtPrice(v: number | null | undefined, digits: number): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtPct(v: number, digits = 2, sign = false): string {
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v).toFixed(digits) + '%';
  if (v < 0 && Math.abs(v) >= 0.5 * 10 ** -digits) return `−${s}`;
  return sign && v > 0 ? `+${s}` : s;
}

export function fmtNum(v: number, maxDigits = 2): string {
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-US', { maximumFractionDigits: maxDigits });
}

/** Decimals needed to show a value rounded to `step` (0.01 → 2). */
export function stepDecimals(step: number): number {
  if (step <= 0) return 2;
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}

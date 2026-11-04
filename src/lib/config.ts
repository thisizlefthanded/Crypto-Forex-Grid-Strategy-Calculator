import { getAsset, type AssetSpec, type QuoteConversion } from './assets';

export type Direction = 'long' | 'short' | 'neutral';
export type Spacing = 'arithmetic' | 'geometric';
export type SizingMode = 'capital' | 'fixed';
export type Allocation = 'equal' | 'martingale' | 'arithmetic';

export interface GridConfig {
  assetId: string;
  contractSize: number;
  pipSize: number;
  digits: number;
  conversion: QuoteConversion;
  volumeStep: number;
  minVolume: number;

  currentPrice: number;
  upperPrice: number;
  lowerPrice: number;
  grids: number;
  spacing: Spacing;
  direction: Direction;

  capital: number;
  leverage: number;
  sizing: SizingMode;
  /** % of capital that may be locked as margin once one side of the grid is fully filled. */
  marginUtilization: number;
  /** Base volume (lots or coins) for the order nearest to the current price, in fixed mode. */
  baseVolume: number;
  allocation: Allocation;
  martingaleMultiplier: number;
  arithmeticIncrement: number;

  spreadPips: number;
  /** Round-turn commission in USD per 1.00 lot. */
  commissionPerLot: number;
  /** Exchange fee in % per side (maker/taker). */
  feePct: number;

  marginCallLevel: number;
  stopOutLevel: number;
  /** Extra % move beyond the grid boundary used for stress-testing. */
  stressPct: number;

  trailingEnabled: boolean;
  /** Trailing distance as a % of one grid step. */
  trailingDistancePct: number;
  trailingMilestones: number;

  executionsPerDay: number;
}

export function configForAsset(asset: AssetSpec, prev?: Partial<GridConfig>): GridConfig {
  const d = asset.defaults;
  const pow = 10 ** asset.digits;
  const round = (v: number) => Math.round(v * pow) / pow;
  return {
    assetId: asset.id,
    contractSize: asset.contractSize,
    pipSize: asset.pipSize,
    digits: asset.digits,
    conversion: asset.conversion,
    volumeStep: asset.volumeStep,
    minVolume: asset.minVolume,

    currentPrice: d.price,
    upperPrice: round(d.price * (1 + d.rangePct / 100)),
    lowerPrice: round(d.price * (1 - d.rangePct / 100)),
    grids: d.grids,
    spacing: prev?.spacing ?? 'arithmetic',
    direction: prev?.direction ?? (asset.assetClass === 'crypto' ? 'long' : 'neutral'),

    capital: prev?.capital ?? 10_000,
    leverage: d.leverage,
    sizing: prev?.sizing ?? 'capital',
    // Leveraged accounts: keep most margin free so the grid survives a breakout.
    marginUtilization: d.leverage === 1 ? 100 : 5,
    baseVolume: asset.assetClass === 'crypto' ? asset.minVolume * 100 : 0.05,
    allocation: prev?.allocation ?? 'equal',
    martingaleMultiplier: prev?.martingaleMultiplier ?? 1.3,
    arithmeticIncrement: prev?.arithmeticIncrement ?? 0.5,

    spreadPips: d.spreadPips,
    commissionPerLot: d.commissionPerLot,
    feePct: d.feePct,

    marginCallLevel: prev?.marginCallLevel ?? 100,
    stopOutLevel: prev?.stopOutLevel ?? 50,
    stressPct: prev?.stressPct ?? 5,

    trailingEnabled: prev?.trailingEnabled ?? true,
    trailingDistancePct: prev?.trailingDistancePct ?? 50,
    trailingMilestones: prev?.trailingMilestones ?? 5,

    executionsPerDay: prev?.executionsPerDay ?? 4,
  };
}

export const DEFAULT_CONFIG: GridConfig = configForAsset(getAsset('XAUUSD'));

const ENUMS = {
  spacing: ['arithmetic', 'geometric'],
  direction: ['long', 'short', 'neutral'],
  sizing: ['capital', 'fixed'],
  allocation: ['equal', 'martingale', 'arithmetic'],
  conversion: ['direct', 'inverse'],
} as const;

const LIMITS: Partial<Record<keyof GridConfig, [number, number]>> = {
  grids: [2, 200],
  leverage: [1, 1000],
  marginUtilization: [1, 100],
  martingaleMultiplier: [1, 3],
  arithmeticIncrement: [0, 5],
  marginCallLevel: [0, 1000],
  stopOutLevel: [0, 1000],
  stressPct: [0, 100],
  trailingDistancePct: [1, 500],
  trailingMilestones: [1, 20],
  executionsPerDay: [0, 1000],
  digits: [0, 8],
};

/**
 * Merges untrusted input (imported JSON, URL hash, localStorage) onto a valid
 * config. Unknown keys are dropped, wrong types fall back to the base value.
 */
export function sanitizeConfig(input: unknown, base: GridConfig = DEFAULT_CONFIG): GridConfig {
  if (!input || typeof input !== 'object') return { ...base };
  const raw = input as Record<string, unknown>;
  const out: GridConfig = { ...base };

  if (typeof raw.assetId === 'string') {
    const asset = getAsset(raw.assetId);
    Object.assign(out, configForAsset(asset), { assetId: asset.id });
  }

  for (const key of Object.keys(base) as (keyof GridConfig)[]) {
    if (!(key in raw)) continue;
    const v = raw[key];
    const current = out[key];
    if (key in ENUMS) {
      const allowed = ENUMS[key as keyof typeof ENUMS] as readonly string[];
      if (typeof v === 'string' && allowed.includes(v)) (out as unknown as Record<string, unknown>)[key] = v;
    } else if (typeof current === 'number') {
      if (typeof v === 'number' && Number.isFinite(v)) {
        const lim = LIMITS[key];
        const clamped = lim ? Math.min(lim[1], Math.max(lim[0], v)) : v;
        (out as unknown as Record<string, unknown>)[key] = clamped;
      }
    } else if (typeof current === 'boolean') {
      if (typeof v === 'boolean') (out as unknown as Record<string, unknown>)[key] = v;
    }
  }
  out.grids = Math.round(out.grids);
  out.trailingMilestones = Math.round(out.trailingMilestones);
  out.digits = Math.round(out.digits);
  return out;
}

/** URL-safe base64 of the config for shareable preset links. */
export function encodeConfig(cfg: GridConfig): string {
  const json = JSON.stringify(cfg);
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeConfig(s: string): GridConfig | null {
  try {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return sanitizeConfig(JSON.parse(json));
  } catch {
    return null;
  }
}

import { describe, expect, it } from 'vitest';
import { getAsset } from './assets';
import { configForAsset, decodeConfig, encodeConfig, sanitizeConfig, type GridConfig } from './config';
import { buildLevels, calculateGrid, roundToStep } from './engine';
import { toCcxtPython, toCsv, toJson, toMetaTraderSet } from './export';

function cfg(over: Partial<GridConfig> = {}): GridConfig {
  return {
    ...configForAsset(getAsset('EURUSD')),
    currentPrice: 1.1,
    upperPrice: 1.2,
    lowerPrice: 1.0,
    grids: 10,
    spacing: 'arithmetic',
    direction: 'long',
    capital: 10_000,
    leverage: 100,
    sizing: 'fixed',
    baseVolume: 0.1,
    allocation: 'equal',
    spreadPips: 0,
    commissionPerLot: 0,
    feePct: 0,
    ...over,
  };
}

describe('levels', () => {
  it('arithmetic step = (upper − lower) / grids', () => {
    const p = buildLevels(1, 1.2, 10, 'arithmetic');
    expect(p).toHaveLength(11);
    expect(p[1] - p[0]).toBeCloseTo(0.02, 10);
    expect(p[10]).toBe(1.2);
  });

  it('geometric spacing has a constant ratio', () => {
    const p = buildLevels(100, 200, 4, 'geometric');
    const ratios = p.slice(1).map((v, i) => v / p[i]);
    ratios.forEach((r) => expect(r).toBeCloseTo(Math.pow(2, 1 / 4), 10));
  });

  it('rounds volume to the broker step', () => {
    expect(roundToStep(0.12345, 0.01)).toBe(0.12);
    expect(roundToStep(0.000126, 0.00001)).toBe(0.00013);
  });
});

describe('calculateGrid — long EUR/USD, fixed 0.1 lot', () => {
  const res = calculateGrid(cfg());

  it('places buy limits only below the current price', () => {
    // Levels 1.00 … 1.08 are below 1.10 (1.10 itself is not strictly below)
    expect(res.buyOrders).toHaveLength(5);
    expect(res.sellOrders).toHaveLength(0);
    expect(res.buyOrders[0].entry).toBeCloseTo(1.08, 10);
    expect(res.buyOrders[0].takeProfit).toBeCloseTo(1.1, 10);
  });

  it('profit per grid = step × units (no costs)', () => {
    // 0.02 × 10,000 units = $200
    res.buyOrders.forEach((o) => expect(o.netProfitUsd).toBeCloseTo(200, 6));
    expect(res.stepPips).toBeCloseTo(200, 6);
  });

  it('max drawdown at the lower limit', () => {
    // entries 1.00,1.02,1.04,1.06,1.08 → distances to 1.00 sum to 0.20 × 10,000 = $2,000
    expect(res.downside!.floatingPnlUsd).toBeCloseTo(-2000, 6);
    expect(res.maxDrawdownPct).toBeCloseTo(20, 6);
    expect(res.executionsToRecover).toBe(10);
  });

  it('margin = notional / leverage', () => {
    // notional at 1.08 = 10,000 × 1.08 = 10,800 → margin 108
    expect(res.buyOrders[0].marginUsd).toBeCloseTo(108, 6);
    expect(res.totals.buyMarginUsd).toBeCloseTo((1.08 + 1.06 + 1.04 + 1.02 + 1.0) * 100, 6);
  });

  it('stop-out price satisfies equity / margin = stop-out level', () => {
    const so = res.stopOut.down!;
    expect(so).toBeLessThan(1.0);
    const margin = res.totals.buyMarginUsd;
    const pnl = res.buyOrders.reduce((s, o) => s + o.units * (so - o.entry), 0);
    expect(((10_000 + pnl) / margin) * 100).toBeCloseTo(50, 4);
  });
});

describe('costs', () => {
  it('subtracts spread, commission and fees', () => {
    const res = calculateGrid(cfg({ spreadPips: 1, commissionPerLot: 7, feePct: 0 }));
    // spread: 1 pip × 10,000 units = $1; commission 0.1 lot × $7 = $0.70
    expect(res.buyOrders[0].costUsd).toBeCloseTo(1.7, 6);
    expect(res.buyOrders[0].netProfitUsd).toBeCloseTo(198.3, 6);
  });

  it('flags grids where costs exceed the step', () => {
    const res = calculateGrid(cfg({ grids: 200, spreadPips: 20 }));
    expect(res.warnings.some((w) => w.level === 'error')).toBe(true);
  });
});

describe('sizing & allocation', () => {
  it('capital mode spends exactly the margin budget', () => {
    const res = calculateGrid(cfg({ sizing: 'capital', marginUtilization: 50, leverage: 1, volumeStep: 1e-9, minVolume: 0 }));
    expect(res.totals.buyMarginUsd).toBeCloseTo(5_000, 2);
  });

  it('martingale multiplies deeper orders', () => {
    const res = calculateGrid(cfg({ allocation: 'martingale', martingaleMultiplier: 2, baseVolume: 0.01 }));
    expect(res.buyOrders.map((o) => o.volume)).toEqual([0.01, 0.02, 0.04, 0.08, 0.16]);
  });

  it('arithmetic tiers grow linearly', () => {
    const res = calculateGrid(cfg({ allocation: 'arithmetic', arithmeticIncrement: 1, baseVolume: 0.01 }));
    expect(res.buyOrders.map((o) => o.volume)).toEqual([0.01, 0.02, 0.03, 0.04, 0.05]);
  });
});

describe('short / neutral / inverse quotes', () => {
  it('short grid loses when price breaks the upper limit', () => {
    const res = calculateGrid(cfg({ direction: 'short' }));
    expect(res.sellOrders).toHaveLength(5);
    expect(res.upside!.floatingPnlUsd).toBeCloseTo(-2000, 6);
  });

  it('neutral grid reports the worse side', () => {
    const res = calculateGrid(cfg({ direction: 'neutral' }));
    expect(res.orders).toHaveLength(10);
    expect(res.maxDrawdownUsd).toBeCloseTo(2000, 6);
  });

  it('USD/JPY profit converts from JPY to USD', () => {
    const res = calculateGrid({
      ...configForAsset(getAsset('USDJPY')),
      currentPrice: 150, upperPrice: 152, lowerPrice: 148, grids: 4, direction: 'long',
      sizing: 'fixed', baseVolume: 1, spreadPips: 0, commissionPerLot: 0, feePct: 0,
    });
    // 1 lot = 100,000 USD; 1 yen move = ¥100,000 → ÷149 ≈ $666.67 (converted at the 150 TP)
    const o = res.buyOrders[0];
    expect(o.entry).toBe(149);
    expect(o.netProfitUsd).toBeCloseTo(100_000 / 150, 4);
    expect(o.notionalUsd).toBeCloseTo(100_000, 4);
  });

  it('spot (1:1) has no stop-out', () => {
    const res = calculateGrid(cfg({ leverage: 1 }));
    expect(res.stopOut.down).toBeNull();
  });
});

describe('trailing take-profit', () => {
  it('first milestone locks the fixed TP, then ratchets one step at a time', () => {
    const res = calculateGrid(cfg({ trailingEnabled: true, trailingDistancePct: 50, trailingMilestones: 3 }));
    const t = res.trailing!;
    expect(t.milestones[0].stopPrice).toBeCloseTo(1.1, 10);
    expect(t.milestones[0].triggerPrice).toBeCloseTo(1.11, 10);
    expect(t.milestones[0].extraVsFixedUsd).toBeCloseTo(0, 6);
    expect(t.milestones[2].lockedProfitUsd).toBeCloseTo(600, 6);
  });
});

describe('validation & config', () => {
  it('rejects an inverted range', () => {
    const res = calculateGrid(cfg({ upperPrice: 0.9 }));
    expect(res.valid).toBe(false);
  });

  it('sanitizes untrusted input', () => {
    const c = sanitizeConfig({ assetId: 'BTCUSDT', grids: 99999, direction: 'sideways', leverage: 'x', capital: 500 });
    expect(c.assetId).toBe('BTCUSDT');
    expect(c.grids).toBe(200);
    expect(c.direction).toBe('long');
    expect(c.leverage).toBe(1);
    expect(c.capital).toBe(500);
  });

  it('round-trips through a share link', () => {
    const c = cfg({ capital: 1234 });
    expect(decodeConfig(encodeConfig(c))).toEqual(c);
  });
});

describe('exports', () => {
  const c = cfg({ direction: 'neutral' });
  const res = calculateGrid(c);
  it('produce parseable / non-empty output', () => {
    expect(JSON.parse(toJson(c, res)).orders).toHaveLength(10);
    expect(toMetaTraderSet(c, res)).toContain('InpGridStepPoints=2000');
    expect(toCcxtPython(c, res)).toContain('SYMBOL = "EUR/USDT"');
    expect(toCsv(c, res).trim().split('\n')).toHaveLength(11);
  });
});

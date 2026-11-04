import type { GridConfig } from './config';

export type Side = 'buy' | 'sell';

export interface GridOrder {
  /** Index of the entry level in the ascending `prices` array. */
  levelIndex: number;
  side: Side;
  entry: number;
  takeProfit: number;
  /** 0 = closest to the current price, increasing as price moves against the position. */
  depth: number;
  weight: number;
  /** Rounded to the volume step — lots for FX/metals, coins for crypto. */
  volume: number;
  units: number;
  notionalUsd: number;
  marginUsd: number;
  grossProfitUsd: number;
  costUsd: number;
  netProfitUsd: number;
  /** Net profit as % of the order notional. */
  netProfitPct: number;
  belowMinVolume: boolean;
}

export interface Scenario {
  label: string;
  price: number;
  filledOrders: number;
  filledVolume: number;
  avgEntry: number | null;
  floatingPnlUsd: number;
  drawdownPct: number;
  equityUsd: number;
  marginUsd: number;
  /** Equity / margin × 100; null when no position is open. */
  marginLevel: number | null;
}

export interface TrailingMilestone {
  step: number;
  triggerPrice: number;
  stopPrice: number;
  lockedProfitUsd: number;
  extraVsFixedUsd: number;
}

export interface ProjectionPoint {
  day: number;
  low: number;
  base: number;
  high: number;
}

export interface Warning {
  level: 'error' | 'warn' | 'info';
  message: string;
}

export interface GridResult {
  valid: boolean;
  prices: number[];
  /** Arithmetic: absolute step. Geometric: step between the two lowest levels. */
  step: number;
  stepPips: number;
  /** Average step as % of price. */
  stepPct: number;
  /** Geometric only: constant ratio between levels, as %. */
  geometricRatioPct: number | null;
  orders: GridOrder[];
  buyOrders: GridOrder[];
  sellOrders: GridOrder[];
  totals: {
    buyVolume: number;
    sellVolume: number;
    buyMarginUsd: number;
    sellMarginUsd: number;
    /** Worst-case margin: one side of the grid fully filled. */
    maxMarginUsd: number;
    maxNotionalUsd: number;
  };
  profit: {
    minNetUsd: number;
    maxNetUsd: number;
    avgNetUsd: number;
    minPct: number;
    maxPct: number;
    avgCostUsd: number;
    /** Average net profit per execution as % of capital. */
    avgPctOfCapital: number;
    /** Profit if every order closes at its TP once (one full sweep). */
    fullCycleUsd: number;
  };
  downside: Scenario | null;
  downsideStress: Scenario | null;
  upside: Scenario | null;
  upsideStress: Scenario | null;
  /** Largest drawdown across the boundary scenarios (not stress). */
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  stopOut: { down: number | null; up: number | null };
  marginCall: { down: number | null; up: number | null };
  /** Executions needed to earn back the max drawdown. */
  executionsToRecover: number | null;
  trailing: { order: GridOrder; trailDistance: number; milestones: TrailingMilestone[] } | null;
  projection: {
    dailyUsd: number;
    monthlyUsd: number;
    monthlyRoiPct: number;
    aprPct: number;
    series: ProjectionPoint[];
  };
  warnings: Warning[];
}

const EPS = 1e-12;

export function toUsd(cfg: Pick<GridConfig, 'conversion'>, amountInQuote: number, price: number): number {
  return cfg.conversion === 'inverse' ? amountInQuote / price : amountInQuote;
}

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - EPS));
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimals));
}

export function buildLevels(lower: number, upper: number, grids: number, spacing: GridConfig['spacing']): number[] {
  const prices: number[] = [];
  if (spacing === 'geometric') {
    const ratio = Math.pow(upper / lower, 1 / grids);
    for (let i = 0; i <= grids; i++) prices.push(lower * Math.pow(ratio, i));
  } else {
    const step = (upper - lower) / grids;
    for (let i = 0; i <= grids; i++) prices.push(lower + step * i);
  }
  prices[grids] = upper; // kill float drift on the top level
  return prices;
}

function weightFor(cfg: GridConfig, depth: number): number {
  switch (cfg.allocation) {
    case 'martingale':
      return Math.pow(cfg.martingaleMultiplier, depth);
    case 'arithmetic':
      return 1 + cfg.arithmeticIncrement * depth;
    default:
      return 1;
  }
}

function emptyResult(warnings: Warning[]): GridResult {
  return {
    valid: false,
    prices: [],
    step: 0,
    stepPips: 0,
    stepPct: 0,
    geometricRatioPct: null,
    orders: [],
    buyOrders: [],
    sellOrders: [],
    totals: { buyVolume: 0, sellVolume: 0, buyMarginUsd: 0, sellMarginUsd: 0, maxMarginUsd: 0, maxNotionalUsd: 0 },
    profit: { minNetUsd: 0, maxNetUsd: 0, avgNetUsd: 0, minPct: 0, maxPct: 0, avgCostUsd: 0, avgPctOfCapital: 0, fullCycleUsd: 0 },
    downside: null,
    downsideStress: null,
    upside: null,
    upsideStress: null,
    maxDrawdownPct: 0,
    maxDrawdownUsd: 0,
    stopOut: { down: null, up: null },
    marginCall: { down: null, up: null },
    executionsToRecover: null,
    trailing: null,
    projection: { dailyUsd: 0, monthlyUsd: 0, monthlyRoiPct: 0, aprPct: 0, series: [] },
    warnings,
  };
}

export function validate(cfg: GridConfig): Warning[] {
  const w: Warning[] = [];
  if (!(cfg.lowerPrice > 0)) w.push({ level: 'error', message: 'Lower limit must be greater than zero.' });
  if (!(cfg.upperPrice > cfg.lowerPrice)) w.push({ level: 'error', message: 'Upper limit must be above the lower limit.' });
  if (!(cfg.currentPrice > 0)) w.push({ level: 'error', message: 'Current price must be greater than zero.' });
  if (!(cfg.grids >= 2)) w.push({ level: 'error', message: 'Use at least 2 grid levels.' });
  if (!(cfg.capital > 0)) w.push({ level: 'error', message: 'Investment capital must be greater than zero.' });
  if (!(cfg.contractSize > 0)) w.push({ level: 'error', message: 'Contract size must be greater than zero.' });
  if (!(cfg.leverage >= 1)) w.push({ level: 'error', message: 'Leverage must be at least 1:1.' });
  if (cfg.sizing === 'fixed' && !(cfg.baseVolume > 0)) w.push({ level: 'error', message: 'Base volume must be greater than zero.' });
  return w;
}

/** Build and size the orders for one side of the grid. */
function buildSide(cfg: GridConfig, prices: number[], side: Side): GridOrder[] {
  const N = prices.length - 1;
  const raw: Omit<GridOrder, 'weight' | 'volume' | 'units' | 'notionalUsd' | 'marginUsd' | 'grossProfitUsd' | 'costUsd' | 'netProfitUsd' | 'netProfitPct' | 'belowMinVolume'>[] = [];

  if (side === 'buy') {
    // Buy limits strictly below the current price; TP one level up.
    const idx: number[] = [];
    for (let i = 0; i < N; i++) if (prices[i] < cfg.currentPrice) idx.push(i);
    idx.sort((a, b) => b - a); // nearest first
    idx.forEach((i, depth) => raw.push({ levelIndex: i, side, entry: prices[i], takeProfit: prices[i + 1], depth }));
  } else {
    // Sell limits strictly above the current price; TP one level down.
    const idx: number[] = [];
    for (let i = 1; i <= N; i++) if (prices[i] > cfg.currentPrice) idx.push(i);
    idx.sort((a, b) => a - b);
    idx.forEach((i, depth) => raw.push({ levelIndex: i, side, entry: prices[i], takeProfit: prices[i - 1], depth }));
  }
  if (raw.length === 0) return [];

  const weights = raw.map((o) => weightFor(cfg, o.depth));
  const unitNotional = (o: (typeof raw)[number]) => toUsd(cfg, cfg.contractSize * o.entry, o.entry);

  // Volume of the depth-0 order; all others are weight × base.
  let baseVolume: number;
  if (cfg.sizing === 'fixed') {
    baseVolume = cfg.baseVolume;
  } else {
    const budgetNotional = cfg.capital * (cfg.marginUtilization / 100) * cfg.leverage;
    const weightedNotionalPerVolume = raw.reduce((s, o, k) => s + weights[k] * unitNotional(o), 0);
    baseVolume = budgetNotional / weightedNotionalPerVolume;
  }

  return raw.map((o, k) => {
    const volume = roundToStep(baseVolume * weights[k], cfg.volumeStep);
    const units = volume * cfg.contractSize;
    const notionalUsd = toUsd(cfg, units * o.entry, o.entry);
    const marginUsd = notionalUsd / cfg.leverage;
    const move = Math.abs(o.takeProfit - o.entry);
    const grossProfitUsd = toUsd(cfg, units * move, o.takeProfit);
    const spreadUsd = toUsd(cfg, cfg.spreadPips * cfg.pipSize * units, o.takeProfit);
    const commissionUsd = cfg.commissionPerLot * (cfg.contractSize > 0 ? units / cfg.contractSize : 0);
    const feeUsd = (cfg.feePct / 100) * (notionalUsd + toUsd(cfg, units * o.takeProfit, o.takeProfit));
    const costUsd = spreadUsd + commissionUsd + feeUsd;
    const netProfitUsd = grossProfitUsd - costUsd;
    return {
      ...o,
      weight: weights[k],
      volume,
      units,
      notionalUsd,
      marginUsd,
      grossProfitUsd,
      costUsd,
      netProfitUsd,
      netProfitPct: notionalUsd > 0 ? (netProfitUsd / notionalUsd) * 100 : 0,
      belowMinVolume: volume < cfg.minVolume - EPS,
    };
  });
}

/**
 * Evaluate the account when price moves to `price`. Orders whose entry has
 * been crossed are treated as open; realised TPs along the way are ignored
 * (conservative — a straight-line move gives the grid no time to recycle).
 */
export function evaluateAt(cfg: GridConfig, orders: GridOrder[], side: Side, price: number, label: string): Scenario {
  const filled = orders.filter((o) => (side === 'buy' ? o.entry >= price : o.entry <= price));
  let pnl = 0;
  let margin = 0;
  let vol = 0;
  let weighted = 0;
  for (const o of filled) {
    const diff = side === 'buy' ? price - o.entry : o.entry - price;
    pnl += toUsd(cfg, o.units * diff, price);
    margin += o.marginUsd;
    vol += o.volume;
    weighted += o.entry * o.volume;
  }
  const equity = cfg.capital + pnl;
  return {
    label,
    price,
    filledOrders: filled.length,
    filledVolume: vol,
    avgEntry: vol > 0 ? weighted / vol : null,
    floatingPnlUsd: pnl,
    drawdownPct: cfg.capital > 0 ? Math.max(0, (-pnl / cfg.capital) * 100) : 0,
    equityUsd: equity,
    marginUsd: margin,
    marginLevel: margin > 0 ? (equity / margin) * 100 : null,
  };
}

/**
 * Find the first price (moving away from the current price) at which the
 * margin level drops to `threshold` %. Between consecutive order entries the
 * set of open positions is fixed and margin level is monotonic, so we check
 * each segment's far end and bisect inside the first one that crosses.
 */
export function findMarginThreshold(cfg: GridConfig, orders: GridOrder[], side: Side, threshold: number): number | null {
  if (orders.length === 0 || cfg.leverage <= 1 || threshold <= 0) return null;
  const sorted = [...orders].sort((a, b) => (side === 'buy' ? b.entry - a.entry : a.entry - b.entry));
  const far = side === 'buy' ? 0 : sorted[sorted.length - 1].entry * 100;
  const breakpoints = [...sorted.map((o) => o.entry), far];

  const levelAt = (p: number) => {
    const s = evaluateAt(cfg, orders, side, p, '');
    if (s.marginLevel === null) return Infinity;
    return s.equityUsd <= 0 ? -Infinity : s.marginLevel;
  };

  for (let k = 0; k < breakpoints.length - 1; k++) {
    // Segment between this order's entry (now open) and the next order's entry (not yet open).
    const start = breakpoints[k];
    const end = breakpoints[k + 1];
    const openSet = sorted.slice(0, k + 1);
    const lvl = (p: number) => {
      const s = evaluateAt(cfg, openSet, side, p, '');
      if (s.marginLevel === null) return Infinity;
      return s.equityUsd <= 0 ? -Infinity : s.marginLevel;
    };
    if (lvl(start) <= threshold) return start;
    const endProbe = side === 'buy' ? Math.max(end, EPS) : end;
    if (lvl(endProbe) > threshold) continue;
    let a = start;
    let b = endProbe;
    for (let it = 0; it < 80; it++) {
      const m = (a + b) / 2;
      if (lvl(m) > threshold) a = m;
      else b = m;
    }
    return (a + b) / 2;
  }
  // Fall-through guard (should be unreachable with the far sentinel).
  return levelAt(far) <= threshold ? far : null;
}

function trailingFor(cfg: GridConfig, order: GridOrder): GridResult['trailing'] {
  const step = Math.abs(order.takeProfit - order.entry);
  const trailDistance = step * (cfg.trailingDistancePct / 100);
  const dir = order.side === 'buy' ? 1 : -1;
  const milestones: TrailingMilestone[] = [];
  for (let k = 0; k < cfg.trailingMilestones; k++) {
    // Trailing activates once price runs `trailDistance` past the TP, so the
    // first locked stop sits exactly on the fixed TP; each further step ratchets it.
    const stopPrice = order.takeProfit + dir * k * step;
    const triggerPrice = stopPrice + dir * trailDistance;
    const move = (stopPrice - order.entry) * dir;
    const gross = toUsd(cfg, order.units * move, stopPrice);
    const locked = gross - order.costUsd;
    milestones.push({
      step: k,
      triggerPrice,
      stopPrice,
      lockedProfitUsd: locked,
      extraVsFixedUsd: locked - order.netProfitUsd,
    });
  }
  return { order, trailDistance, milestones };
}

export function calculateGrid(cfg: GridConfig): GridResult {
  const errors = validate(cfg);
  if (errors.length) return emptyResult(errors);

  const warnings: Warning[] = [];
  const prices = buildLevels(cfg.lowerPrice, cfg.upperPrice, cfg.grids, cfg.spacing);
  const buyOrders = cfg.direction === 'short' ? [] : buildSide(cfg, prices, 'buy');
  const sellOrders = cfg.direction === 'long' ? [] : buildSide(cfg, prices, 'sell');
  const orders = [...sellOrders].reverse().concat(buyOrders); // top → bottom

  const step = prices[1] - prices[0];
  const midPrice = (cfg.upperPrice + cfg.lowerPrice) / 2;
  const geometricRatioPct = cfg.spacing === 'geometric' ? (prices[1] / prices[0] - 1) * 100 : null;
  const stepPct = cfg.spacing === 'geometric' ? geometricRatioPct! : (step / midPrice) * 100;

  if (cfg.currentPrice > cfg.upperPrice || cfg.currentPrice < cfg.lowerPrice) {
    warnings.push({ level: 'warn', message: 'Current price is outside the grid range — every level sits on one side of the market.' });
  }
  if (orders.length === 0) {
    warnings.push({
      level: 'warn',
      message:
        cfg.direction === 'long'
          ? 'No buy levels below the current price. Lower the bottom limit or switch direction.'
          : cfg.direction === 'short'
            ? 'No sell levels above the current price. Raise the upper limit or switch direction.'
            : 'No grid levels on either side of the current price.',
    });
  }

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const buyMarginUsd = sum(buyOrders.map((o) => o.marginUsd));
  const sellMarginUsd = sum(sellOrders.map((o) => o.marginUsd));
  const totals = {
    buyVolume: sum(buyOrders.map((o) => o.volume)),
    sellVolume: sum(sellOrders.map((o) => o.volume)),
    buyMarginUsd,
    sellMarginUsd,
    maxMarginUsd: Math.max(buyMarginUsd, sellMarginUsd),
    maxNotionalUsd: Math.max(sum(buyOrders.map((o) => o.notionalUsd)), sum(sellOrders.map((o) => o.notionalUsd))),
  };

  const live = orders.filter((o) => o.volume > 0);
  const nets = live.map((o) => o.netProfitUsd);
  const pcts = live.map((o) => o.netProfitPct);
  const avgNetUsd = nets.length ? sum(nets) / nets.length : 0;
  const profit = {
    minNetUsd: nets.length ? Math.min(...nets) : 0,
    maxNetUsd: nets.length ? Math.max(...nets) : 0,
    avgNetUsd,
    minPct: pcts.length ? Math.min(...pcts) : 0,
    maxPct: pcts.length ? Math.max(...pcts) : 0,
    avgCostUsd: live.length ? sum(live.map((o) => o.costUsd)) / live.length : 0,
    avgPctOfCapital: (avgNetUsd / cfg.capital) * 100,
    fullCycleUsd: sum(nets),
  };

  if (orders.some((o) => o.belowMinVolume)) {
    warnings.push({
      level: 'warn',
      message: `Some orders round below the broker minimum (${cfg.minVolume}). Increase capital, utilisation or base volume, or reduce the number of grids.`,
    });
  }
  if (live.length && profit.minNetUsd <= 0) {
    warnings.push({ level: 'error', message: 'Trading costs eat the whole grid step on some levels — those levels lose money on every execution. Widen the step or reduce costs.' });
  } else if (live.length && profit.avgCostUsd > 0.4 * (profit.avgNetUsd + profit.avgCostUsd)) {
    warnings.push({ level: 'warn', message: 'Costs take more than 40% of the gross profit per grid. Consider fewer, wider grids.' });
  }

  const stress = cfg.stressPct / 100;
  const downside = buyOrders.length ? evaluateAt(cfg, buyOrders, 'buy', cfg.lowerPrice, 'Breaks lower limit') : null;
  const downsideStress = buyOrders.length ? evaluateAt(cfg, buyOrders, 'buy', cfg.lowerPrice * Math.max(1e-6, 1 - stress), `Lower limit −${cfg.stressPct}%`) : null;
  const upside = sellOrders.length ? evaluateAt(cfg, sellOrders, 'sell', cfg.upperPrice, 'Breaks upper limit') : null;
  const upsideStress = sellOrders.length ? evaluateAt(cfg, sellOrders, 'sell', cfg.upperPrice * (1 + stress), `Upper limit +${cfg.stressPct}%`) : null;

  const ddDown = downside ? -Math.min(0, downside.floatingPnlUsd) : 0;
  const ddUp = upside ? -Math.min(0, upside.floatingPnlUsd) : 0;
  const maxDrawdownUsd = Math.max(ddDown, ddUp);
  const maxDrawdownPct = (maxDrawdownUsd / cfg.capital) * 100;

  const stopOut = {
    down: findMarginThreshold(cfg, buyOrders, 'buy', cfg.stopOutLevel),
    up: findMarginThreshold(cfg, sellOrders, 'sell', cfg.stopOutLevel),
  };
  const marginCall = {
    down: findMarginThreshold(cfg, buyOrders, 'buy', cfg.marginCallLevel),
    up: findMarginThreshold(cfg, sellOrders, 'sell', cfg.marginCallLevel),
  };

  if ((stopOut.down !== null && stopOut.down >= cfg.lowerPrice) || (stopOut.up !== null && stopOut.up <= cfg.upperPrice)) {
    warnings.push({ level: 'error', message: 'Stop-out is reached INSIDE the grid range — the broker would liquidate before the grid completes. Reduce size or leverage.' });
  } else if ((marginCall.down !== null && marginCall.down >= cfg.lowerPrice) || (marginCall.up !== null && marginCall.up <= cfg.upperPrice)) {
    warnings.push({ level: 'warn', message: 'A margin call is triggered inside the grid range.' });
  }
  if (maxDrawdownPct >= 100) {
    warnings.push({ level: 'error', message: 'A breakout to the grid boundary would wipe out the whole account.' });
  } else if (maxDrawdownPct >= 50) {
    warnings.push({ level: 'warn', message: `A breakout to the grid boundary costs ${maxDrawdownPct.toFixed(1)}% of capital.` });
  }

  const nearest = [...buyOrders.slice(0, 1), ...sellOrders.slice(0, 1)].sort(
    (a, b) => Math.abs(a.entry - cfg.currentPrice) - Math.abs(b.entry - cfg.currentPrice),
  )[0];
  const trailing = cfg.trailingEnabled && nearest ? trailingFor(cfg, nearest) : null;

  const dailyUsd = avgNetUsd * cfg.executionsPerDay;
  const series: ProjectionPoint[] = [];
  for (let day = 0; day <= 30; day++) {
    series.push({ day, low: dailyUsd * 0.5 * day, base: dailyUsd * day, high: dailyUsd * 1.5 * day });
  }
  const projection = {
    dailyUsd,
    monthlyUsd: dailyUsd * 30,
    monthlyRoiPct: ((dailyUsd * 30) / cfg.capital) * 100,
    aprPct: ((dailyUsd * 365) / cfg.capital) * 100,
    series,
  };

  return {
    valid: true,
    prices,
    step,
    stepPips: step / cfg.pipSize,
    stepPct,
    geometricRatioPct,
    orders,
    buyOrders,
    sellOrders,
    totals,
    profit,
    downside,
    downsideStress,
    upside,
    upsideStress,
    maxDrawdownPct,
    maxDrawdownUsd,
    stopOut,
    marginCall,
    executionsToRecover: avgNetUsd > 0 && maxDrawdownUsd > 0 ? Math.ceil(maxDrawdownUsd / avgNetUsd - 1e-9) : null,
    trailing,
    projection,
    warnings,
  };
}

import { Layers } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GridConfig } from '../lib/config';
import type { GridOrder, GridResult } from '../lib/engine';
import { fmtNum, fmtPct, fmtPrice, fmtUsd } from '../lib/format';
import { Card } from './ui/Card';

const W = 560;
const H = 520;
const PAD = { top: 18, bottom: 18, left: 78, right: 14 };
const BAR_MAX = 150;

const COLORS = {
  buy: '#22e3a0',
  sell: '#ff6b7a',
  idle: '#34414f',
  cyan: '#2ad4ff',
  amber: '#ffb547',
};

export function PriceLadder({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const d = cfg.digits;

  const model = useMemo(() => {
    const lo = Math.min(cfg.lowerPrice, cfg.currentPrice);
    const hi = Math.max(cfg.upperPrice, cfg.currentPrice);
    const pad = (hi - lo) * 0.07 || hi * 0.01;
    const yMin = lo - pad;
    const yMax = hi + pad;
    const y = (p: number) => PAD.top + ((yMax - p) / (yMax - yMin)) * (H - PAD.top - PAD.bottom);
    const byLevel = new Map<number, GridOrder[]>();
    res.orders.forEach((o) => byLevel.set(o.levelIndex, [...(byLevel.get(o.levelIndex) ?? []), o]));
    const maxVol = Math.max(...res.orders.map((o) => o.volume), 1e-12);
    // Thin out price labels so they never overlap (≥ 14px apart).
    const labelEvery = Math.max(1, Math.ceil(14 / ((H - PAD.top - PAD.bottom) / res.prices.length)));
    return { y, yMin, yMax, byLevel, maxVol, labelEvery };
  }, [cfg.lowerPrice, cfg.upperPrice, cfg.currentPrice, res.orders, res.prices]);

  const { y, yMin, yMax, byLevel, maxVol, labelEvery } = model;
  const lines: { price: number; label: string; color: string }[] = [];
  const offChart: { label: string; price: number; dir: 'up' | 'down'; color: string }[] = [];
  const addMarker = (price: number | null, label: string, color: string) => {
    if (price === null) return;
    if (price >= yMin && price <= yMax) lines.push({ price, label, color });
    else offChart.push({ price, label, color, dir: price > yMax ? 'up' : 'down' });
  };
  addMarker(res.stopOut.down, 'STOP-OUT', COLORS.sell);
  addMarker(res.stopOut.up, 'STOP-OUT', COLORS.sell);
  addMarker(res.marginCall.down, 'MARGIN CALL', COLORS.amber);
  addMarker(res.marginCall.up, 'MARGIN CALL', COLORS.amber);

  const hovered = hover !== null ? { price: res.prices[hover], orders: byLevel.get(hover) ?? [] } : null;
  const barX = W - PAD.right - BAR_MAX;
  const rowH = (H - PAD.top - PAD.bottom) / Math.max(1, res.prices.length - 1);

  return (
    <Card
      title="Grid price ladder"
      icon={<Layers size={14} />}
      bodyClass="p-0"
      actions={
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-ink-400">
          <Legend color={COLORS.buy} label={`Buy ${res.buyOrders.length}`} />
          <Legend color={COLORS.sell} label={`Sell ${res.sellOrders.length}`} />
          <Legend color={COLORS.cyan} label="Price" />
        </div>
      }
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Grid ladder with ${res.prices.length} levels from ${fmtPrice(cfg.lowerPrice, d)} to ${fmtPrice(cfg.upperPrice, d)}`} onMouseLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="rangeFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS.sell} stopOpacity="0.06" />
              <stop offset="50%" stopColor={COLORS.cyan} stopOpacity="0.02" />
              <stop offset="100%" stopColor={COLORS.buy} stopOpacity="0.06" />
            </linearGradient>
          </defs>

          <rect x={PAD.left} y={y(cfg.upperPrice)} width={W - PAD.left - PAD.right} height={Math.max(0, y(cfg.lowerPrice) - y(cfg.upperPrice))} fill="url(#rangeFill)" />

          {res.prices.map((p, i) => {
            const orders = byLevel.get(i) ?? [];
            const side = orders[0]?.side;
            const color = side === 'buy' ? COLORS.buy : side === 'sell' ? COLORS.sell : COLORS.idle;
            const yy = y(p);
            const isHover = hover === i;
            const showLabel = i % labelEvery === 0 || i === res.prices.length - 1 || isHover;
            return (
              <g key={i}>
                <line x1={PAD.left} x2={W - PAD.right} y1={yy} y2={yy} stroke={color} strokeOpacity={isHover ? 1 : side ? 0.55 : 0.5} strokeWidth={isHover ? 1.5 : 1} strokeDasharray={side ? undefined : '3 4'} />
                {showLabel && (
                  <text x={PAD.left - 8} y={yy} dy="0.32em" textAnchor="end" className="font-mono" fontSize="10.5" fill={isHover ? '#e2e9f0' : side ? color : '#5b6b7d'}>
                    {fmtPrice(p, d)}
                  </text>
                )}
                {orders.map((o) => {
                  const w = Math.max(2, (o.volume / maxVol) * BAR_MAX);
                  return (
                    <g key={o.side}>
                      <rect x={W - PAD.right - w} y={yy - 3} width={w} height={6} rx={1.5} fill={color} fillOpacity={isHover ? 0.95 : 0.7} />
                      {/* TP arrow: entry → next level */}
                      <line x1={barX - 14} x2={barX - 14} y1={yy} y2={y(o.takeProfit) + (o.side === 'buy' ? 3 : -3)} stroke={color} strokeOpacity={0.45} strokeWidth={1} />
                      <path
                        d={o.side === 'buy' ? `M${barX - 17},${y(o.takeProfit) + 5} l3,-4 l3,4` : `M${barX - 17},${y(o.takeProfit) - 5} l3,4 l3,-4`}
                        fill="none"
                        stroke={color}
                        strokeOpacity={0.7}
                      />
                    </g>
                  );
                })}
                <rect x={0} y={yy - rowH / 2} width={W} height={rowH} fill="transparent" onMouseEnter={() => setHover(i)} />
              </g>
            );
          })}

          {lines.map((l) => (
            <g key={l.label + l.price} pointerEvents="none">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeWidth={1.25} strokeDasharray="6 4" />
              <text
                x={l.label === 'STOP-OUT' ? barX - 26 : PAD.left + 6}
                y={y(l.price) - 5}
                textAnchor={l.label === 'STOP-OUT' ? 'end' : 'start'}
                className="font-mono"
                fontSize="9.5"
                fill={l.color}
                letterSpacing="0.08em"
              >
                {l.label} {fmtPrice(l.price, d)}
              </text>
            </g>
          ))}

          {/* Current price */}
          <g pointerEvents="none">
            <line x1={PAD.left - 4} x2={W - PAD.right} y1={y(cfg.currentPrice)} y2={y(cfg.currentPrice)} stroke={COLORS.cyan} strokeWidth={1.5} />
            <rect x={2} y={y(cfg.currentPrice) - 9} width={PAD.left - 6} height={18} rx={3} fill={COLORS.cyan} />
            <text x={(PAD.left - 4) / 2 + 1} y={y(cfg.currentPrice)} dy="0.34em" textAnchor="middle" className="font-mono" fontSize="10.5" fontWeight="600" fill="#06080c">
              {fmtPrice(cfg.currentPrice, d)}
            </text>
          </g>
        </svg>

        {offChart.length > 0 && (
          <div className="pointer-events-none absolute right-3 bottom-2 left-20 flex flex-wrap justify-end gap-x-3 font-mono text-[10px]">
            {offChart.map((m) => (
              <span key={m.label + m.price} style={{ color: m.color }}>
                {m.dir === 'down' ? '↓' : '↑'} {m.label} {fmtPrice(m.price, d)}
              </span>
            ))}
          </div>
        )}

        {hovered && (
          <div className="pointer-events-none absolute top-3 left-24 min-w-52 rounded-md border border-ink-600 bg-ink-850/95 px-3 py-2 font-mono text-[11px] shadow-xl shadow-black/40">
            <div className="mb-1 flex justify-between gap-4 text-ink-100">
              <span>{fmtPrice(hovered.price, d)}</span>
              <span className="text-ink-400">{fmtPct((hovered.price / cfg.currentPrice - 1) * 100, 2, true)}</span>
            </div>
            {hovered.orders.length === 0 && <div className="text-ink-400">TP / boundary level</div>}
            {hovered.orders.map((o) => (
              <div key={o.side} className="mt-1 grid grid-cols-2 gap-x-3 border-t border-ink-700 pt-1">
                <span className={o.side === 'buy' ? 'text-profit' : 'text-risk'}>{o.side.toUpperCase()} LIMIT</span>
                <span className="text-right text-ink-200">{fmtNum(o.volume, 6)}</span>
                <span className="text-ink-400">TP</span>
                <span className="text-right text-ink-200">{fmtPrice(o.takeProfit, d)}</span>
                <span className="text-ink-400">Net</span>
                <span className="text-right text-profit">{fmtUsd(o.netProfitUsd)}</span>
                <span className="text-ink-400">Margin</span>
                <span className="text-right text-ink-200">{fmtUsd(o.marginUsd)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-0.5 w-3 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

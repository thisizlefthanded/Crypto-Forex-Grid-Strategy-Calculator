import { TrendingUp } from 'lucide-react';
import { useState } from 'react';
import type { GridConfig } from '../lib/config';
import type { GridResult } from '../lib/engine';
import { fmtNum, fmtPct, fmtUsd } from '../lib/format';
import { Card } from './ui/Card';

const W = 560;
const H = 230;
const PAD = { top: 16, right: 16, bottom: 26, left: 58 };

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  return ticks;
}

export function RoiChart({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const s = res.projection.series;
  const maxY = Math.max(...s.map((p) => p.high), 1e-9);
  const ticks = niceTicks(maxY);
  const top = Math.max(ticks[ticks.length - 1], maxY);
  const x = (day: number) => PAD.left + (day / 30) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v / top) * (H - PAD.top - PAD.bottom);

  const path = (key: 'low' | 'base' | 'high') => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.day)},${y(Math.max(0, p[key]))}`).join(' ');
  const band = `${path('high')} ${[...s].reverse().map((p) => `L${x(p.day)},${y(Math.max(0, p.low))}`).join(' ')} Z`;
  const positive = res.projection.dailyUsd > 0;
  const h = hover !== null ? s[hover] : null;
  const ddDays = res.projection.dailyUsd > 0 && res.maxDrawdownUsd > 0 ? res.maxDrawdownUsd / res.projection.dailyUsd : null;

  return (
    <Card
      title="Projected ROI · 30 days"
      icon={<TrendingUp size={14} />}
      bodyClass="p-0"
      actions={<span className="font-mono text-[10.5px] text-ink-400">{fmtNum(cfg.executionsPerDay, 0)} exec/day · band ±50%</span>}
    >
      {!positive ? (
        <div className="flex h-[230px] flex-col items-center justify-center gap-1 px-6 text-center">
          <p className="text-sm text-ink-300">No positive projection yet</p>
          <p className="max-w-sm text-xs text-ink-500">
            {res.orders.length === 0
              ? 'Add grid levels on the active side of the market to project returns.'
              : cfg.executionsPerDay === 0
                ? 'Set the expected executions per day to see projected growth.'
                : 'Costs exceed the grid step. Widen the step or lower spread / fees.'}
          </p>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Projected cumulative profit ${fmtUsd(res.projection.monthlyUsd)} over 30 days`} onMouseLeave={() => setHover(null)}
            onMouseMove={(e) => {
              const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
              const px = ((e.clientX - r.left) / r.width) * W;
              const day = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * 30);
              setHover(day >= 0 && day <= 30 ? day : null);
            }}
          >
            <defs>
              <linearGradient id="roiFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22e3a0" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#22e3a0" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#18212d" />
                <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" className="font-mono" fill="#5b6b7d">
                  {fmtUsd(t, { compact: true }).replace('.00', '')}
                </text>
              </g>
            ))}
            {[0, 7, 14, 21, 30].map((d) => (
              <text key={d} x={x(d)} y={H - 8} textAnchor="middle" fontSize="10" className="font-mono" fill="#5b6b7d">
                {d === 0 ? 'Day 0' : `D${d}`}
              </text>
            ))}
            <path d={band} fill="url(#roiFill)" />
            <path d={path('low')} fill="none" stroke="#22e3a0" strokeOpacity="0.3" strokeDasharray="3 3" />
            <path d={path('high')} fill="none" stroke="#22e3a0" strokeOpacity="0.3" strokeDasharray="3 3" />
            <path d={path('base')} fill="none" stroke="#22e3a0" strokeWidth="2" />
            {h && (
              <g pointerEvents="none">
                <line x1={x(h.day)} x2={x(h.day)} y1={PAD.top} y2={H - PAD.bottom} stroke="#5b6b7d" strokeDasharray="2 3" />
                <circle cx={x(h.day)} cy={y(h.base)} r="4" fill="#06080c" stroke="#22e3a0" strokeWidth="2" />
              </g>
            )}
          </svg>
          <div className="pointer-events-none absolute top-3 left-16 rounded border border-ink-700 bg-ink-850/90 px-2.5 py-1.5 font-mono text-[11px]">
            {h ? (
              <>
                <span className="text-ink-400">Day {h.day}</span>{' '}
                <span className="text-profit">{fmtUsd(h.base, { sign: true })}</span>{' '}
                <span className="text-ink-500">({fmtPct((h.base / cfg.capital) * 100, 2, true)})</span>
              </>
            ) : (
              <>
                <span className="text-ink-400">Daily</span> <span className="text-profit">{fmtUsd(res.projection.dailyUsd, { sign: true })}</span>
                {ddDays !== null && (
                  <span className="text-ink-500"> · {fmtNum(ddDays, 1)} days of grid profit = max DD</span>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

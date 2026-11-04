import { Activity, ArrowDownUp, CircleDollarSign, Landmark, ShieldX, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';
import type { GridConfig } from '../lib/config';
import type { GridResult } from '../lib/engine';
import { fmtNum, fmtPct, fmtPrice, fmtUsd } from '../lib/format';
import type { GlossaryKey } from '../lib/glossary';
import { InfoTip } from './ui/InfoTip';

type Tone = 'neutral' | 'profit' | 'risk' | 'amber' | 'cyan';
const TONE: Record<Tone, string> = {
  neutral: 'text-ink-100',
  profit: 'text-profit',
  risk: 'text-risk',
  amber: 'text-amber',
  cyan: 'text-cyan',
};

function Stat({ label, term, icon, value, sub, tone = 'neutral', align }: {
  label: string;
  term: GlossaryKey;
  icon: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  tone?: Tone;
  align?: 'right';
}) {
  return (
    <div className="relative rounded-lg border border-ink-700 bg-ink-900/80 p-3.5">
      <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.1em] text-ink-400 uppercase">
        <span className="text-ink-500">{icon}</span>
        {label}
        <InfoTip term={term} align={align === 'right' ? 'right' : 'left'} />
      </div>
      <div className={`tabular mt-2 truncate font-mono text-xl font-medium ${TONE[tone]}`}>{value}</div>
      <div className="tabular mt-1 truncate font-mono text-[11px] text-ink-400">{sub}</div>
    </div>
  );
}

export function StatCards({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  const d = cfg.digits;
  const ddTone: Tone = res.maxDrawdownPct >= 50 ? 'risk' : res.maxDrawdownPct >= 20 ? 'amber' : 'profit';
  const marginPct = (res.totals.maxMarginUsd / cfg.capital) * 100;
  const so = [res.stopOut.down, res.stopOut.up]
    .filter((v): v is number => v !== null)
    .sort((a, b) => Math.abs(a - cfg.currentPrice) - Math.abs(b - cfg.currentPrice));
  const soInside = (res.stopOut.down !== null && res.stopOut.down >= cfg.lowerPrice) || (res.stopOut.up !== null && res.stopOut.up <= cfg.upperPrice);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 min-[1760px]:grid-cols-6">
      <Stat
        label="Grid step"
        term="gridStep"
        icon={<ArrowDownUp size={12} />}
        tone="cyan"
        value={fmtPrice(res.step, d)}
        sub={`${fmtNum(res.stepPips, 1)} pips · ${fmtPct(res.stepPct, 3)}${cfg.spacing === 'geometric' ? ' ratio' : ''}`}
      />
      <Stat
        label="Profit / grid"
        term="profitPerGrid"
        icon={<CircleDollarSign size={12} />}
        tone={res.profit.avgNetUsd > 0 ? 'profit' : 'risk'}
        value={fmtUsd(res.profit.avgNetUsd)}
        sub={
          res.profit.minPct === res.profit.maxPct
            ? `${fmtPct(res.profit.minPct, 3)} per grid`
            : `${fmtPct(res.profit.minPct, 3)} – ${fmtPct(res.profit.maxPct, 3)}`
        }
      />
      <Stat
        label="Max drawdown"
        term="maxDrawdown"
        icon={<Activity size={12} />}
        tone={ddTone}
        value={fmtPct(res.maxDrawdownPct, 1)}
        sub={`${fmtUsd(-res.maxDrawdownUsd, { compact: true })} at boundary`}
      />
      <Stat
        label="Margin req."
        term="leverage"
        icon={<Landmark size={12} />}
        tone={marginPct > 80 ? 'amber' : 'neutral'}
        value={fmtUsd(res.totals.maxMarginUsd, { compact: true })}
        sub={`${fmtPct(marginPct, 1)} of capital · 1:${fmtNum(cfg.leverage, 0)}`}
        align="right"
      />
      <Stat
        label="Stop-out"
        term="stopOut"
        icon={<ShieldX size={12} />}
        tone={so.length === 0 ? 'profit' : soInside ? 'risk' : 'amber'}
        value={so.length === 0 ? 'None' : fmtPrice(so[0], d)}
        sub={
          so.length === 0
            ? cfg.leverage <= 1 ? 'unleveraged — no liquidation' : 'account survives any move'
            : soInside
              ? 'INSIDE GRID RANGE'
              : `${fmtPct((so[0] / cfg.currentPrice - 1) * 100, 1, true)}${so[1] !== undefined ? ` · other ${fmtPrice(so[1], d)}` : ''}`
        }
        align="right"
      />
      <Stat
        label="Est. monthly"
        term="executions"
        icon={<TrendingUp size={12} />}
        tone={res.projection.monthlyUsd > 0 ? 'profit' : 'risk'}
        value={fmtPct(res.projection.monthlyRoiPct, 2, true)}
        sub={`${fmtUsd(res.projection.monthlyUsd, { compact: true, sign: true })} · APR ${fmtPct(res.projection.aprPct, 0)}`}
        align="right"
      />
    </div>
  );
}

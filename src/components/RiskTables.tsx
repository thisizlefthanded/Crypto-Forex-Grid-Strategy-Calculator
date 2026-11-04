import { ChevronsUp, Info, ListOrdered, OctagonAlert, ShieldAlert, TriangleAlert } from 'lucide-react';
import type { GridConfig } from '../lib/config';
import type { GridResult, Scenario, Warning } from '../lib/engine';
import { fmtNum, fmtPct, fmtPrice, fmtUsd, stepDecimals } from '../lib/format';
import { Card } from './ui/Card';
import { InfoTip } from './ui/InfoTip';

const th = 'px-3 py-2 text-left font-mono text-[10px] font-medium tracking-[0.1em] text-ink-400 uppercase whitespace-nowrap';
const td = 'tabular px-3 py-1.5 font-mono text-xs whitespace-nowrap';

export function Warnings({ warnings }: { warnings: Warning[] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {warnings.map((w) => {
        const style =
          w.level === 'error'
            ? 'border-risk/40 bg-risk/8 text-risk'
            : w.level === 'warn'
              ? 'border-amber/35 bg-amber/6 text-amber'
              : 'border-cyan/30 bg-cyan/5 text-cyan';
        const Icon = w.level === 'error' ? OctagonAlert : w.level === 'warn' ? TriangleAlert : Info;
        return (
          <div key={w.message} className={`flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs leading-relaxed ${style}`}>
            <Icon size={14} className="mt-0.5 shrink-0" />
            <span className="text-ink-200">{w.message}</span>
          </div>
        );
      })}
    </div>
  );
}

function ScenarioRow({ s, cfg }: { s: Scenario; cfg: GridConfig }) {
  const ml = s.marginLevel;
  const mlTone = ml === null ? 'text-ink-400' : ml <= cfg.stopOutLevel ? 'text-risk' : ml <= cfg.marginCallLevel ? 'text-amber' : 'text-ink-200';
  return (
    <tr className="border-t border-ink-800">
      <td className={`${td} font-sans text-ink-200`}>{s.label}</td>
      <td className={`${td} text-ink-200`}>{fmtPrice(s.price, cfg.digits)}</td>
      <td className={`${td} text-ink-300`}>{s.filledOrders} · {fmtNum(s.filledVolume, stepDecimals(cfg.volumeStep))}</td>
      <td className={`${td} text-ink-300`}>{fmtPrice(s.avgEntry, cfg.digits)}</td>
      <td className={`${td} ${s.floatingPnlUsd < 0 ? 'text-risk' : 'text-profit'}`}>{fmtUsd(s.floatingPnlUsd, { sign: true })}</td>
      <td className={`${td} ${s.drawdownPct >= 50 ? 'text-risk' : s.drawdownPct >= 20 ? 'text-amber' : 'text-ink-200'}`}>{fmtPct(s.drawdownPct, 1)}</td>
      <td className={`${td} ${s.equityUsd <= 0 ? 'text-risk' : 'text-ink-200'}`}>{fmtUsd(s.equityUsd)}</td>
      <td className={`${td} ${mlTone}`}>{ml === null ? '—' : ml < 0 ? 'Wiped' : fmtPct(ml, 0)}</td>
    </tr>
  );
}

export function RiskMatrix({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  const scenarios = [res.downside, res.downsideStress, res.upside, res.upsideStress].filter((s): s is Scenario => s !== null);
  const d = cfg.digits;
  const triggers: [string, number | null, string][] = [
    ['Margin call ↓', res.marginCall.down, 'text-amber'],
    ['Stop-out ↓', res.stopOut.down, 'text-risk'],
    ['Margin call ↑', res.marginCall.up, 'text-amber'],
    ['Stop-out ↑', res.stopOut.up, 'text-risk'],
  ];
  const relevant = triggers.filter(([label]) =>
    label.endsWith('↓') ? res.buyOrders.length > 0 : res.sellOrders.length > 0,
  );

  return (
    <Card title="Risk & profitability matrix" icon={<ShieldAlert size={14} />} bodyClass="p-0">
      <div className="grid grid-cols-2 gap-px border-b border-ink-700 bg-ink-700 sm:grid-cols-4">
        <Metric label="Full-cycle profit" value={fmtUsd(res.profit.fullCycleUsd)} sub="every level hits TP once" tone="text-profit" />
        <Metric label="Avg cost / trade" value={fmtUsd(res.profit.avgCostUsd)} sub="spread + comm. + fees" />
        <Metric
          label="Executions to recover"
          term="recover"
          value={res.executionsToRecover === null ? '—' : fmtNum(res.executionsToRecover, 0)}
          sub="to earn back max DD"
          tone={res.executionsToRecover !== null && res.executionsToRecover > 200 ? 'text-amber' : 'text-ink-100'}
        />
        <Metric label="Exposure (max side)" value={fmtUsd(res.totals.maxNotionalUsd, { compact: true })} sub={`${fmtNum(res.totals.maxNotionalUsd / cfg.capital, 1)}× capital`} />
      </div>

      <div className="scroll-thin overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className={th}>Breakout scenario</th>
              <th className={th}>Price</th>
              <th className={th}>Filled</th>
              <th className={th}>Avg entry</th>
              <th className={th}>Floating P/L</th>
              <th className={th}><span className="inline-flex items-center gap-1">Drawdown <InfoTip term="maxDrawdown" /></span></th>
              <th className={th}>Equity</th>
              <th className={th}><span className="inline-flex items-center gap-1">Margin lvl <InfoTip term="marginLevel" align="right" /></span></th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <ScenarioRow key={s.label} s={s} cfg={cfg} />
            ))}
            {scenarios.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-ink-500">No open-position scenarios — the grid has no active orders.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {relevant.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-ink-700 px-3 py-2.5 font-mono text-[11px]">
          {relevant.map(([label, price, tone]) => (
            <span key={label} className="text-ink-400">
              {label} @{' '}
              <span className={price === null ? 'text-profit' : tone}>
                {price === null ? (cfg.leverage <= 1 ? 'n/a (spot)' : 'never') : `${fmtPrice(price, d)} (${fmtPct((price / cfg.currentPrice - 1) * 100, 1, true)})`}
              </span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

function Metric({ label, value, sub, tone = 'text-ink-100', term }: { label: string; value: string; sub: string; tone?: string; term?: 'recover' }) {
  return (
    <div className="bg-ink-900 px-3 py-2.5">
      <div className="flex items-center gap-1 font-mono text-[10px] tracking-[0.1em] text-ink-400 uppercase">
        {label}
        {term && <InfoTip term={term} />}
      </div>
      <div className={`tabular mt-1 font-mono text-sm ${tone}`}>{value}</div>
      <div className="text-[11px] text-ink-500">{sub}</div>
    </div>
  );
}

export function TrailingMilestones({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  if (!cfg.trailingEnabled) return null;
  const t = res.trailing;
  const d = cfg.digits;
  return (
    <Card
      title="Trailing take-profit milestones"
      icon={<ChevronsUp size={14} />}
      bodyClass="p-0"
      actions={t && <span className="font-mono text-[10.5px] text-ink-400">trail {fmtPrice(t.trailDistance, d)} · {t.order.side} @ {fmtPrice(t.order.entry, d)}</span>}
    >
      {!t ? (
        <p className="px-4 py-6 text-center text-xs text-ink-500">No active order to trail.</p>
      ) : (
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Milestone</th>
                <th className={th}>Price reaches</th>
                <th className={th}>Stop moves to</th>
                <th className={th}>Locked profit</th>
                <th className={th}>Extra vs TP</th>
              </tr>
            </thead>
            <tbody>
              {t.milestones.map((m) => (
                <tr key={m.step} className="border-t border-ink-800">
                  <td className={`${td} text-ink-300`}>{m.step === 0 ? 'Activation' : `TP + ${m.step} step${m.step > 1 ? 's' : ''}`}</td>
                  <td className={`${td} text-cyan`}>{fmtPrice(m.triggerPrice, d)}</td>
                  <td className={`${td} text-ink-200`}>{fmtPrice(m.stopPrice, d)}</td>
                  <td className={`${td} text-profit`}>{fmtUsd(m.lockedProfitUsd)}</td>
                  <td className={`${td} ${m.extraVsFixedUsd > 0.005 ? 'text-profit' : 'text-ink-400'}`}>{fmtUsd(m.extraVsFixedUsd, { sign: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function LevelsTable({ cfg, res }: { cfg: GridConfig; res: GridResult }) {
  const d = cfg.digits;
  const vd = stepDecimals(cfg.volumeStep);
  return (
    <Card title={`Order book · ${res.orders.length} orders`} icon={<ListOrdered size={14} />} bodyClass="p-0">
      <div className="scroll-thin max-h-[420px] overflow-auto">
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-ink-900">
            <tr>
              <th className={th}>#</th>
              <th className={th}>Side</th>
              <th className={th}>Entry</th>
              <th className={th}>Take profit</th>
              <th className={th}>Volume</th>
              <th className={th}>Margin</th>
              <th className={th}>Cost</th>
              <th className={th}>Net / grid</th>
              <th className={th}>%</th>
            </tr>
          </thead>
          <tbody>
            {res.orders.map((o, i) => {
              const crossing = i > 0 && res.orders[i - 1].side === 'sell' && o.side === 'buy';
              return (
                <tr key={`${o.side}-${o.levelIndex}`} className={`border-t hover:bg-ink-800/60 ${crossing ? 'border-cyan/50' : 'border-ink-800'}`}>
                  <td className={`${td} text-ink-500`}>{i + 1}</td>
                  <td className={`${td} ${o.side === 'buy' ? 'text-profit' : 'text-risk'}`}>{o.side === 'buy' ? 'BUY LMT' : 'SELL LMT'}</td>
                  <td className={`${td} text-ink-100`}>{fmtPrice(o.entry, d)}</td>
                  <td className={`${td} text-ink-300`}>{fmtPrice(o.takeProfit, d)}</td>
                  <td className={`${td} ${o.belowMinVolume ? 'text-amber' : 'text-ink-200'}`}>{o.volume.toFixed(vd)}</td>
                  <td className={`${td} text-ink-300`}>{fmtUsd(o.marginUsd)}</td>
                  <td className={`${td} text-ink-400`}>{fmtUsd(o.costUsd)}</td>
                  <td className={`${td} ${o.netProfitUsd > 0 ? 'text-profit' : 'text-risk'}`}>{fmtUsd(o.netProfitUsd)}</td>
                  <td className={`${td} text-ink-400`}>{fmtPct(o.netProfitPct, 3)}</td>
                </tr>
              );
            })}
            {res.orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-ink-500">
                  No orders on the active side. Move the current price inside the range or change direction.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

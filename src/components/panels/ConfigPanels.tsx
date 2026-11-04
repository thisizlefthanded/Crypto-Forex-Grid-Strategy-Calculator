import { Coins, Gauge, LineChart, Receipt, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { ASSETS, ASSET_CLASS_LABEL, getAsset, type AssetClass } from '../../lib/assets';
import { configForAsset, type GridConfig } from '../../lib/config';
import type { GridResult } from '../../lib/engine';
import { fmtNum, fmtPct, fmtPrice } from '../../lib/format';
import { Card } from '../ui/Card';
import { Label, NumberInput, Segmented, SliderField, Toggle } from '../ui/Field';

export interface PanelProps {
  cfg: GridConfig;
  set: (patch: Partial<GridConfig>) => void;
  replace: (cfg: GridConfig) => void;
  res: GridResult;
}

const LEVERAGE_PRESETS = [1, 10, 50, 100, 200, 300, 500];

export function MarketPanel({ cfg, set, replace }: PanelProps) {
  const asset = getAsset(cfg.assetId);
  const classes = Object.keys(ASSET_CLASS_LABEL) as AssetClass[];
  const tick = 10 ** -cfg.digits;
  const pickClass = (c: AssetClass) => {
    if (c === asset.assetClass) return;
    replace(configForAsset(ASSETS.find((a) => a.assetClass === c)!, cfg));
  };

  return (
    <Card title="Market" icon={<Coins size={14} />}>
      <div className="space-y-4">
        <Segmented
          ariaLabel="Asset class"
          value={asset.assetClass}
          onChange={pickClass}
          options={classes.map((c) => ({ value: c, label: ASSET_CLASS_LABEL[c] }))}
        />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Instrument">
          {ASSETS.filter((a) => a.assetClass === asset.assetClass).map((a) => {
            const active = a.id === cfg.assetId;
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={active}
                title={a.name}
                onClick={() => !active && replace(configForAsset(a, cfg))}
                className={`rounded border px-2.5 py-1 font-mono text-xs transition-colors ${
                  active ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-ink-600 text-ink-300 hover:border-ink-500 hover:text-ink-100'
                }`}
              >
                {a.symbol}
              </button>
            );
          })}
        </div>

        <SliderField
          id="currentPrice"
          label="Current market price"
          term="currentPrice"
          value={cfg.currentPrice}
          onChange={(v) => set({ currentPrice: v })}
          min={tick}
          max={1e9}
          step={tick}
          sliderMin={cfg.lowerPrice}
          sliderMax={cfg.upperPrice}
          invalid={!(cfg.currentPrice > 0)}
        />

        <details className="group rounded-md border border-ink-700 bg-ink-950/40">
          <summary className="cursor-pointer list-none px-3 py-2 text-xs text-ink-400 select-none hover:text-ink-200">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> Contract specification
            <span className="ml-2 font-mono text-ink-500">
              {fmtNum(cfg.contractSize)} / {asset.volumeUnit === 'lots' ? 'lot' : 'coin'} · pip {cfg.pipSize}
            </span>
          </summary>
          <div className="grid grid-cols-2 gap-3 border-t border-ink-700 p-3">
            <div>
              <Label term="contractSize" htmlFor="contractSize">Contract size</Label>
              <NumberInput id="contractSize" value={cfg.contractSize} onChange={(v) => set({ contractSize: v })} min={0} />
            </div>
            <div>
              <Label term="pipSize" htmlFor="pipSize">Pip / point size</Label>
              <NumberInput id="pipSize" value={cfg.pipSize} onChange={(v) => set({ pipSize: v })} min={0} />
            </div>
            <div>
              <Label htmlFor="volumeStep">Volume step</Label>
              <NumberInput id="volumeStep" value={cfg.volumeStep} onChange={(v) => set({ volumeStep: v, minVolume: Math.min(cfg.minVolume, v) })} min={0} />
            </div>
            <div>
              <Label htmlFor="digits">Price digits</Label>
              <NumberInput id="digits" value={cfg.digits} onChange={(v) => set({ digits: Math.round(v) })} min={0} max={8} step={1} />
            </div>
          </div>
        </details>
      </div>
    </Card>
  );
}

export function GridPanel({ cfg, set, res }: PanelProps) {
  const tick = 10 ** -cfg.digits;
  const span = Math.max(cfg.currentPrice, tick) * 0.5;
  const rangeBad = !(cfg.upperPrice > cfg.lowerPrice);
  return (
    <Card title="Grid range" icon={<SlidersHorizontal size={14} />}>
      <div className="space-y-4">
        <SliderField
          id="upperPrice"
          label="Upper limit"
          term="upper"
          value={cfg.upperPrice}
          onChange={(v) => set({ upperPrice: v })}
          min={tick}
          max={1e9}
          step={tick}
          sliderMin={cfg.currentPrice}
          sliderMax={cfg.currentPrice + span}
          invalid={rangeBad}
          hint={cfg.currentPrice > 0 ? fmtPct((cfg.upperPrice / cfg.currentPrice - 1) * 100, 2, true) : undefined}
        />
        <SliderField
          id="lowerPrice"
          label="Lower limit"
          term="lower"
          value={cfg.lowerPrice}
          onChange={(v) => set({ lowerPrice: v })}
          min={tick}
          max={1e9}
          step={tick}
          sliderMin={Math.max(tick, cfg.currentPrice - span)}
          sliderMax={cfg.currentPrice}
          invalid={rangeBad || !(cfg.lowerPrice > 0)}
          hint={cfg.currentPrice > 0 ? fmtPct((cfg.lowerPrice / cfg.currentPrice - 1) * 100, 2, true) : undefined}
        />
        <SliderField
          id="grids"
          label="Number of grids"
          term="grids"
          value={cfg.grids}
          onChange={(v) => set({ grids: Math.round(v) })}
          min={2}
          max={200}
          step={1}
          sliderMax={100}
          hint={res.valid ? `step ${fmtPrice(res.step, cfg.digits)} · ${fmtNum(res.stepPips, 1)} pips` : undefined}
        />
        <div>
          <Label term="spacing">Spacing</Label>
          <Segmented
            ariaLabel="Grid spacing"
            value={cfg.spacing}
            onChange={(v) => set({ spacing: v })}
            options={[
              { value: 'arithmetic', label: 'Arithmetic' },
              { value: 'geometric', label: 'Geometric' },
            ]}
          />
        </div>
        <div>
          <Label term="direction">Direction</Label>
          <Segmented
            ariaLabel="Grid direction"
            value={cfg.direction}
            onChange={(v) => set({ direction: v })}
            options={[
              { value: 'long', label: 'Long', tone: 'profit' },
              { value: 'neutral', label: 'Neutral', tone: 'cyan' },
              { value: 'short', label: 'Short', tone: 'risk' },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}

export function CapitalPanel({ cfg, set }: PanelProps) {
  const asset = getAsset(cfg.assetId);
  const unit = asset.volumeUnit === 'lots' ? 'lot' : asset.symbol.split('/')[0];
  return (
    <Card title="Capital & sizing" icon={<Gauge size={14} />}>
      <div className="space-y-4">
        <div>
          <Label term="capital" htmlFor="capital">Investment capital</Label>
          <NumberInput id="capital" value={cfg.capital} onChange={(v) => set({ capital: v })} min={0} step={100} prefix="$" invalid={!(cfg.capital > 0)} />
        </div>

        <div>
          <Label term="leverage" htmlFor="leverage" right={<span className="font-mono text-xs text-cyan">1:{fmtNum(cfg.leverage, 0)}</span>}>
            Leverage
          </Label>
          <div className="mb-2 grid grid-cols-7 gap-1">
            {LEVERAGE_PRESETS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => set({ leverage: l })}
                aria-pressed={cfg.leverage === l}
                className={`rounded border py-1 font-mono text-[11px] transition-colors ${
                  cfg.leverage === l ? 'border-cyan/60 bg-cyan/10 text-cyan' : 'border-ink-700 text-ink-400 hover:border-ink-500 hover:text-ink-200'
                }`}
              >
                {l === 1 ? 'Spot' : l}
              </button>
            ))}
          </div>
          <NumberInput id="leverage" value={cfg.leverage} onChange={(v) => set({ leverage: v })} min={1} max={1000} step={1} prefix="1:" />
        </div>

        <div>
          <Label term="sizing">Order sizing</Label>
          <Segmented
            ariaLabel="Order sizing mode"
            value={cfg.sizing}
            onChange={(v) => set({ sizing: v })}
            options={[
              { value: 'capital', label: 'From capital' },
              { value: 'fixed', label: `Fixed ${unit}` },
            ]}
          />
        </div>

        {cfg.sizing === 'capital' ? (
          <SliderField
            id="util"
            label="Margin utilisation"
            term="utilization"
            value={cfg.marginUtilization}
            onChange={(v) => set({ marginUtilization: v })}
            min={1}
            max={100}
            step={1}
            suffix="%"
          />
        ) : (
          <div>
            <Label term="baseVolume" htmlFor="baseVolume">Base volume per order</Label>
            <NumberInput
              id="baseVolume"
              value={cfg.baseVolume}
              onChange={(v) => set({ baseVolume: v })}
              min={0}
              step={cfg.volumeStep}
              suffix={asset.volumeUnit === 'lots' ? 'lots' : unit}
              invalid={!(cfg.baseVolume > 0)}
            />
          </div>
        )}

        <div>
          <Label term="allocation">Volume allocation</Label>
          <Segmented
            ariaLabel="Volume allocation"
            value={cfg.allocation}
            onChange={(v) => set({ allocation: v })}
            options={[
              { value: 'equal', label: 'Equal' },
              { value: 'martingale', label: 'Martingale' },
              { value: 'arithmetic', label: 'Arithmetic' },
            ]}
          />
        </div>
        {cfg.allocation === 'martingale' && (
          <SliderField id="mult" label="Multiplier per level" value={cfg.martingaleMultiplier} onChange={(v) => set({ martingaleMultiplier: v })} min={1} max={3} step={0.05} suffix="×" />
        )}
        {cfg.allocation === 'arithmetic' && (
          <SliderField id="inc" label="Increment per level" value={cfg.arithmeticIncrement} onChange={(v) => set({ arithmeticIncrement: v })} min={0} max={5} step={0.05} suffix="× base" />
        )}
      </div>
    </Card>
  );
}

export function CostsPanel({ cfg, set }: PanelProps) {
  return (
    <Card title="Trading costs" icon={<Receipt size={14} />}>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label term="spread" htmlFor="spread">Spread</Label>
          <NumberInput id="spread" value={cfg.spreadPips} onChange={(v) => set({ spreadPips: v })} min={0} step={0.1} suffix="pip" />
        </div>
        <div>
          <Label term="commission" htmlFor="comm">Comm.</Label>
          <NumberInput id="comm" value={cfg.commissionPerLot} onChange={(v) => set({ commissionPerLot: v })} min={0} step={0.5} prefix="$" />
        </div>
        <div>
          <Label term="fee" htmlFor="fee">Fee</Label>
          <NumberInput id="fee" value={cfg.feePct} onChange={(v) => set({ feePct: v })} min={0} step={0.01} suffix="%" />
        </div>
      </div>
    </Card>
  );
}

export function RiskPanel({ cfg, set }: PanelProps) {
  return (
    <Card title="Risk & projection" icon={<ShieldAlert size={14} />}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label term="marginCall" htmlFor="mc">Margin call</Label>
            <NumberInput id="mc" value={cfg.marginCallLevel} onChange={(v) => set({ marginCallLevel: v })} min={0} max={1000} step={10} suffix="%" />
          </div>
          <div>
            <Label term="stopOut" htmlFor="so">Stop-out</Label>
            <NumberInput id="so" value={cfg.stopOutLevel} onChange={(v) => set({ stopOutLevel: v })} min={0} max={1000} step={10} suffix="%" />
          </div>
          <div>
            <Label term="stress" htmlFor="stress">Stress</Label>
            <NumberInput id="stress" value={cfg.stressPct} onChange={(v) => set({ stressPct: v })} min={0} max={100} step={1} suffix="%" />
          </div>
        </div>

        <SliderField
          id="exec"
          label="Grid executions per day"
          term="executions"
          value={cfg.executionsPerDay}
          onChange={(v) => set({ executionsPerDay: v })}
          min={0}
          max={1000}
          step={1}
          sliderMax={60}
        />

        <div className="rounded-md border border-ink-700 bg-ink-950/40 p-3">
          <div className="flex items-center justify-between">
            <Label term="trailing">
              <LineChart size={12} className="text-cyan" /> Trailing take-profit
            </Label>
            <Toggle checked={cfg.trailingEnabled} onChange={(v) => set({ trailingEnabled: v })} label="Enable trailing take-profit" />
          </div>
          {cfg.trailingEnabled && (
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <Label term="trailingDistance" htmlFor="trailDist">Trail distance</Label>
                <NumberInput id="trailDist" value={cfg.trailingDistancePct} onChange={(v) => set({ trailingDistancePct: v })} min={1} max={500} step={5} suffix="% step" />
              </div>
              <div>
                <Label htmlFor="trailMs">Milestones</Label>
                <NumberInput id="trailMs" value={cfg.trailingMilestones} onChange={(v) => set({ trailingMilestones: Math.round(v) })} min={1} max={20} step={1} />
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportDialog } from './components/ExportDialog';
import { Header } from './components/Header';
import { CapitalPanel, CostsPanel, GridPanel, MarketPanel, RiskPanel, type PanelProps } from './components/panels/ConfigPanels';
import { PriceLadder } from './components/PriceLadder';
import { LevelsTable, RiskMatrix, TrailingMilestones, Warnings } from './components/RiskTables';
import { RoiChart } from './components/RoiChart';
import { StatCards } from './components/StatCards';
import { DEFAULT_CONFIG, decodeConfig, encodeConfig, sanitizeConfig, type GridConfig } from './lib/config';
import { calculateGrid } from './lib/engine';
import { copyText } from './lib/export';

const STORAGE_KEY = 'gridcalc:config:v1';

function loadInitial(): GridConfig {
  const m = window.location.hash.match(/cfg=([\w-]+)/);
  if (m) {
    const fromLink = decodeConfig(m[1]);
    if (fromLink) return fromLink;
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return sanitizeConfig(JSON.parse(stored));
  } catch {
    /* private mode or corrupted entry — fall back to defaults */
  }
  return DEFAULT_CONFIG;
}

export default function App() {
  const [cfg, setCfg] = useState<GridConfig>(loadInitial);
  const [exportOpen, setExportOpen] = useState(false);
  const res = useMemo(() => calculateGrid(cfg), [cfg]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      } catch {
        /* storage full / disabled */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [cfg]);

  // Drop a consumed share hash so later edits don't look like the shared preset.
  useEffect(() => {
    if (window.location.hash.includes('cfg=')) history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const set = useCallback((patch: Partial<GridConfig>) => setCfg((c) => ({ ...c, ...patch })), []);
  const panel: PanelProps = { cfg, set, replace: setCfg, res };

  const share = () => {
    const url = `${window.location.origin}${window.location.pathname}#cfg=${encodeConfig(cfg)}`;
    return copyText(url);
  };

  return (
    <div className="min-h-screen">
      <Header cfg={cfg} onShare={share} onExport={() => setExportOpen(true)} onReset={() => setCfg(DEFAULT_CONFIG)} />

      <main className="mx-auto grid max-w-[1800px] gap-4 p-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:p-6">
        <aside className="scroll-thin space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-1" aria-label="Strategy inputs">
          <MarketPanel {...panel} />
          <GridPanel {...panel} />
          <CapitalPanel {...panel} />
          <CostsPanel {...panel} />
          <RiskPanel {...panel} />
        </aside>

        <div className="min-w-0 space-y-4">
          <Warnings warnings={res.warnings} />
          {res.valid ? (
            <>
              <StatCards cfg={cfg} res={res} />
              <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
                <PriceLadder cfg={cfg} res={res} />
                <div className="min-w-0 space-y-4">
                  <RoiChart cfg={cfg} res={res} />
                  <TrailingMilestones cfg={cfg} res={res} />
                </div>
              </div>
              <RiskMatrix cfg={cfg} res={res} />
              <LevelsTable cfg={cfg} res={res} />
            </>
          ) : (
            <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed border-ink-600 text-center">
              <p className="text-sm text-ink-200">Fix the highlighted inputs to see the grid</p>
              <p className="mt-1 max-w-sm text-xs text-ink-500">Results update instantly as soon as the range, capital and grid count are valid.</p>
            </div>
          )}
          <footer className="pt-2 pb-6 text-[11px] leading-relaxed text-ink-500">
            Estimates only — not financial advice. Projections assume every execution completes at its take-profit; real fills, slippage, swaps and funding
            costs will differ. Drawdown figures assume a straight-line move with no TPs realised on the way.
          </footer>
        </div>
      </main>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} cfg={cfg} res={res} onImport={setCfg} />
    </div>
  );
}

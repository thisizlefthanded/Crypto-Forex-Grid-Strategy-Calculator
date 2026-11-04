import { Check, Download, RotateCcw, Share2 } from 'lucide-react';
import { useState } from 'react';
import { getAsset } from '../lib/assets';
import type { GridConfig } from '../lib/config';
import { fmtPrice } from '../lib/format';

const REPO_URL = 'https://github.com/thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator';

export function Header({ cfg, onShare, onExport, onReset }: {
  cfg: GridConfig;
  onShare: () => Promise<boolean>;
  onExport: () => void;
  onReset: () => void;
}) {
  const [shared, setShared] = useState(false);
  const asset = getAsset(cfg.assetId);
  const btn = 'flex h-8 items-center gap-1.5 rounded-md border border-ink-600 px-2.5 text-xs text-ink-200 transition-colors hover:border-ink-500 hover:bg-ink-800';

  return (
    <header className="sticky top-0 z-40 border-b border-ink-700 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#111821" stroke="#222d3b" />
            <g strokeWidth="2" strokeLinecap="round">
              <path d="M7 9h18" stroke="#ff6b7a" />
              <path d="M7 14h18" stroke="#2ad4ff" strokeDasharray="2 3" />
              <path d="M7 19h18" stroke="#22e3a0" />
              <path d="M7 24h18" stroke="#22e3a0" />
            </g>
          </svg>
          <div className="leading-tight">
            <div className="font-mono text-sm font-semibold tracking-tight text-ink-100">
              GRID<span className="text-cyan">CALC</span>
            </div>
            <div className="hidden text-[10.5px] text-ink-400 sm:block">Crypto &amp; Forex grid strategy calculator</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-2.5 py-1 font-mono text-xs md:flex">
          <span className="text-ink-100">{asset.symbol}</span>
          <span className="text-cyan">{fmtPrice(cfg.currentPrice, cfg.digits)}</span>
          <span className="text-ink-500">·</span>
          <span className={cfg.direction === 'long' ? 'text-profit' : cfg.direction === 'short' ? 'text-risk' : 'text-cyan'}>{cfg.direction.toUpperCase()}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onReset} className={btn} title="Reset to defaults">
            <RotateCcw size={14} />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            type="button"
            className={btn}
            title="Copy a link that restores this exact setup"
            onClick={async () => {
              if (await onShare()) {
                setShared(true);
                setTimeout(() => setShared(false), 1600);
              }
            }}
          >
            {shared ? <Check size={14} className="text-profit" /> : <Share2 size={14} />}
            <span className="hidden sm:inline">{shared ? 'Link copied' : 'Share'}</span>
          </button>
          <button type="button" onClick={onExport} className="flex h-8 items-center gap-1.5 rounded-md bg-cyan px-3 text-xs font-medium text-ink-950 transition-colors hover:bg-cyan/85">
            <Download size={14} />
            Export
          </button>
          <a href={REPO_URL} target="_blank" rel="noreferrer" aria-label="Source code on GitHub" className="hidden h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-ink-800 hover:text-ink-100 sm:flex">
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}

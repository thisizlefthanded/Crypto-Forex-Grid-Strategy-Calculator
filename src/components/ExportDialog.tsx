import { Bot, Check, Copy, Download, FileCode, FileJson, Sheet, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getAsset } from '../lib/assets';
import { sanitizeConfig, type GridConfig } from '../lib/config';
import type { GridResult } from '../lib/engine';
import { copyText, downloadText, toCcxtPython, toCsv, toJson, toMetaTraderSet } from '../lib/export';

type Tab = 'json' | 'mt' | 'ccxt' | 'csv' | 'import';

const TABS: { id: Tab; label: string; icon: typeof FileJson }[] = [
  { id: 'json', label: 'JSON', icon: FileJson },
  { id: 'mt', label: 'MetaTrader .set', icon: FileCode },
  { id: 'ccxt', label: 'CCXT Python', icon: Bot },
  { id: 'csv', label: 'CSV', icon: Sheet },
  { id: 'import', label: 'Import', icon: Upload },
];

export function ExportDialog({ open, onClose, cfg, res, onImport }: {
  open: boolean;
  onClose: () => void;
  cfg: GridConfig;
  res: GridResult;
  onImport: (cfg: GridConfig) => void;
}) {
  const [tab, setTab] = useState<Tab>('json');
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const symbol = getAsset(cfg.assetId).id.toLowerCase();
  const output = useMemo(() => {
    if (!open || tab === 'import') return null;
    switch (tab) {
      case 'json':
        return { text: toJson(cfg, res), file: `grid-${symbol}.json`, mime: 'application/json' };
      case 'mt':
        return { text: toMetaTraderSet(cfg, res), file: `grid-${symbol}.set`, mime: 'text/plain' };
      case 'ccxt':
        return { text: toCcxtPython(cfg, res), file: `grid_${symbol}.py`, mime: 'text/x-python' };
      case 'csv':
        return { text: toCsv(cfg, res), file: `grid-${symbol}.csv`, mime: 'text/csv' };
    }
  }, [open, tab, cfg, res, symbol]);

  const doCopy = async () => {
    if (!output) return;
    if (await copyText(output.text)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const applyImport = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      // Accept either a full export ({ config: … }) or a bare config object.
      const raw = parsed && typeof parsed === 'object' && 'config' in parsed ? parsed.config : parsed;
      if (!raw || typeof raw !== 'object' || !('upperPrice' in raw || 'assetId' in raw)) {
        throw new Error('This JSON does not look like a grid strategy.');
      }
      onImport(sanitizeConfig(raw));
      setImportError(null);
      setImportText('');
      onClose();
    } catch (e) {
      setImportError(e instanceof SyntaxError ? 'Invalid JSON.' : (e as Error).message);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto w-[min(860px,calc(100vw-2rem))] rounded-xl border border-ink-600 bg-ink-900 p-0 text-ink-200 shadow-2xl shadow-black/60 backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-ink-700 px-5 py-3">
        <h2 className="font-mono text-xs tracking-[0.12em] text-ink-300 uppercase">Export &amp; share strategy</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
          <X size={16} />
        </button>
      </div>

      <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-ink-700 px-3 pt-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs whitespace-nowrap transition-colors ${
              tab === t.id ? 'border-cyan text-cyan' : 'border-transparent text-ink-400 hover:text-ink-200'
            }`}
          >
            <t.icon size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {output && (
        <div className="p-5">
          <p className="mb-3 text-xs leading-relaxed text-ink-400">
            {tab === 'json' && 'Complete configuration, summary and order list. Re-import it here later, or feed it to your own tooling.'}
            {tab === 'mt' && 'MetaTrader 4/5 input preset. Load it from the EA “Inputs” tab; input names follow common grid-EA conventions — rename keys to match your EA.'}
            {tab === 'ccxt' && 'Standalone Python script for any CCXT exchange. Runs in dry-run mode until you set DRY_RUN = False.'}
            {tab === 'csv' && 'Order ladder for spreadsheets — one row per grid order.'}
          </p>
          <pre className="scroll-thin max-h-[52vh] overflow-auto rounded-md border border-ink-700 bg-ink-950 p-4 font-mono text-[11.5px] leading-relaxed text-ink-200">
            {output.text}
          </pre>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={doCopy} className="flex items-center gap-1.5 rounded-md border border-ink-600 px-3 py-2 text-xs text-ink-200 hover:border-ink-500 hover:bg-ink-800">
              {copied ? <Check size={14} className="text-profit" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => downloadText(output.file, output.text, output.mime)}
              className="flex items-center gap-1.5 rounded-md bg-cyan px-3 py-2 text-xs font-medium text-ink-950 hover:bg-cyan/85"
            >
              <Download size={14} />
              Download {output.file}
            </button>
          </div>
        </div>
      )}

      {tab === 'import' && (
        <div className="space-y-3 p-5">
          <p className="text-xs text-ink-400">Paste a JSON export (or a bare config object), or load a .json file. Unknown fields are ignored and values are range-checked.</p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            spellCheck={false}
            placeholder='{ "config": { "assetId": "XAUUSD", "upperPrice": 2750, … } }'
            className="scroll-thin h-56 w-full resize-y rounded-md border border-ink-600 bg-ink-950 p-3 font-mono text-xs text-ink-200 outline-none placeholder:text-ink-500 focus:border-cyan/70"
          />
          {importError && <p className="text-xs text-risk">{importError}</p>}
          <div className="flex justify-between gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) applyImport(await f.text());
                e.target.value = '';
              }}
            />
            <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 rounded-md border border-ink-600 px-3 py-2 text-xs text-ink-200 hover:border-ink-500 hover:bg-ink-800">
              <Upload size={14} /> Load file…
            </button>
            <button
              type="button"
              disabled={!importText.trim()}
              onClick={() => applyImport(importText)}
              className="rounded-md bg-cyan px-4 py-2 text-xs font-medium text-ink-950 hover:bg-cyan/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply configuration
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

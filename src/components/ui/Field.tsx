import { useEffect, useState, type ReactNode } from 'react';
import type { GlossaryKey } from '../../lib/glossary';
import { InfoTip } from './InfoTip';

export function Label({ children, term, htmlFor, right }: { children: ReactNode; term?: GlossaryKey; htmlFor?: string; right?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-xs font-medium text-ink-300">
        {children}
        {term && <InfoTip term={term} />}
      </label>
      {right}
    </div>
  );
}

interface NumberInputProps {
  id?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  prefix?: string;
  suffix?: string;
  invalid?: boolean;
  ariaLabel?: string;
}

/** Text-backed numeric input so partial values like "1." or "" don't fight the user while typing. */
export function NumberInput({ id, value, onChange, step, min, max, prefix, suffix, invalid, ariaLabel }: NumberInputProps) {
  const [text, setText] = useState(() => String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      className={`flex h-9 items-center rounded-md border bg-ink-950/60 font-mono text-sm transition-colors focus-within:border-cyan/70 ${
        invalid ? 'border-risk/70' : 'border-ink-600 hover:border-ink-500'
      }`}
    >
      {prefix && <span className="pl-2.5 text-ink-400">{prefix}</span>}
      <input
        id={id}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        type="number"
        inputMode="decimal"
        step={step ?? 'any'}
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        }}
        onBlur={() => {
          let n = Number(text);
          if (!Number.isFinite(n) || text.trim() === '') n = value;
          if (min !== undefined) n = Math.max(min, n);
          if (max !== undefined) n = Math.min(max, n);
          setText(String(n));
          if (n !== value) onChange(n);
        }}
        className="tabular h-full w-full min-w-0 bg-transparent px-2.5 text-ink-100 outline-none"
      />
      {suffix && <span className="pr-2.5 text-xs text-ink-400">{suffix}</span>}
    </div>
  );
}

interface SliderFieldProps extends Omit<NumberInputProps, 'min' | 'max' | 'step'> {
  label: ReactNode;
  term?: GlossaryKey;
  min: number;
  max: number;
  step: number;
  /** Optional slider bounds that differ from the hard input limits. */
  sliderMin?: number;
  sliderMax?: number;
  hint?: ReactNode;
}

export function SliderField({ label, term, min, max, step, sliderMin, sliderMax, hint, value, onChange, id, ...rest }: SliderFieldProps) {
  const lo = sliderMin ?? min;
  const hi = sliderMax ?? max;
  const fill = hi > lo ? ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo)) * 100 : 0;
  return (
    <div>
      <Label term={term} htmlFor={id} right={hint && <span className="font-mono text-[11px] text-ink-400">{hint}</span>}>
        {label}
      </Label>
      <NumberInput id={id} value={value} onChange={onChange} min={min} max={max} step={step} {...rest} />
      <input
        type="range"
        aria-label={typeof label === 'string' ? `${label} slider` : 'slider'}
        className="range mt-1.5"
        min={lo}
        max={hi}
        step={step}
        value={Math.min(hi, Math.max(lo, value))}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, ariaLabel }: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; tone?: 'profit' | 'risk' | 'cyan' }[];
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="grid auto-cols-fr grid-flow-col gap-1 rounded-md border border-ink-700 bg-ink-950/60 p-1">
      {options.map((o) => {
        const active = o.value === value;
        const tone = o.tone === 'profit' ? 'text-profit' : o.tone === 'risk' ? 'text-risk' : 'text-cyan';
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex h-7 items-center justify-center gap-1.5 rounded px-2 text-xs font-medium transition-colors ${
              active ? `bg-ink-700 ${tone} shadow-sm` : 'text-ink-400 hover:bg-ink-800 hover:text-ink-200'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-cyan/80' : 'bg-ink-600'}`}
    >
      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-ink-100 transition-transform ${checked ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
    </button>
  );
}

import { Info } from 'lucide-react';
import { useId, useState } from 'react';
import { GLOSSARY, type GlossaryKey } from '../../lib/glossary';

export function InfoTip({ term, text, align = 'left' }: { term?: GlossaryKey; text?: string; align?: 'left' | 'right' }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const body = text ?? (term ? GLOSSARY[term] : '');
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="What does this mean?"
        aria-describedby={open ? id : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full text-ink-400 transition-colors hover:text-cyan focus-visible:text-cyan"
      >
        <Info size={13} strokeWidth={2} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-full z-50 mt-2 w-64 rounded-md border border-ink-600 bg-ink-800 px-3 py-2 text-xs leading-relaxed font-normal normal-case tracking-normal text-ink-200 shadow-xl shadow-black/50 ${
            align === 'right' ? 'right-0' : '-left-2'
          }`}
        >
          {body}
        </span>
      )}
    </span>
  );
}

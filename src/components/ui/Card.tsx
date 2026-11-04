import type { ReactNode } from 'react';

export function Card({ title, icon, actions, children, className = '', bodyClass = 'p-4' }: {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`rounded-lg border border-ink-700 bg-ink-900/80 backdrop-blur-sm ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-ink-700 px-4 py-2.5">
          <h2 className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-[0.12em] text-ink-300 uppercase">
            {icon && <span className="text-cyan">{icon}</span>}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

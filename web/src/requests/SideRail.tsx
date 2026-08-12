import { type ReactNode } from "react";

export function RailColumn({ children }: { children: ReactNode }) {
  return (
    <aside className="hidden lg:flex lg:flex-col gap-6 w-56 shrink-0 self-start sticky top-10">
      {children}
    </aside>
  );
}

export function RailCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rail-card">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-dark">
        {eyebrow}
      </p>
      <h2 className="font-display text-sm font-semibold mt-1 mb-3">{title}</h2>
      {children}
    </div>
  );
}

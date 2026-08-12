import { type ReactNode } from "react";

export function SideRail({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <aside className="hidden lg:block w-56 shrink-0">
      <div className="sticky top-10 rail-card">
        <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-amber-dark">
          {eyebrow}
        </p>
        <h2 className="font-display text-sm font-semibold mt-1 mb-3">
          {title}
        </h2>
        {children}
      </div>
    </aside>
  );
}

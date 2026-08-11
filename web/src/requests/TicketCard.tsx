import { type ReactNode } from "react";
import { StatusStamp } from "./StatusStamp";

export function TicketCard({
  id,
  title,
  meta,
  status,
  children,
}: {
  id: string;
  title: string;
  meta: string;
  status: string;
  children?: ReactNode;
}) {
  const ticketNo = `#${id.slice(0, 6).toUpperCase()}`;

  return (
    <li className="ticket">
      <div className="ticket-notch-left" />
      <div className="ticket-notch-right" />

      <div className="flex items-start justify-between px-5 pt-4">
        <span className="font-mono text-xs tracking-wide text-ink/50">
          {ticketNo}
        </span>
        <StatusStamp status={status} />
      </div>

      <div className="ticket-perforation px-5 pt-4 pb-5">
        <h3 className="font-display text-lg font-semibold leading-tight">
          {title}
        </h3>
        <p className="font-mono text-xs uppercase tracking-wide text-ink/50 mt-1">
          {meta}
        </p>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}

import { type CSSProperties, type ReactNode, useState } from "react";
import { StatusStamp } from "./StatusStamp";
import { StatusTimeline } from "./StatusTimeline";

const STUB_COLOR: Record<string, string> = {
  pending: "rgba(124, 117, 102, 0.35)",
  approved: "rgba(91, 130, 101, 0.35)",
  rejected: "rgba(178, 75, 60, 0.35)",
  revision_requested: "rgba(110, 106, 158, 0.35)",
};

export function TicketCard({
  id,
  title,
  meta,
  status,
  description,
  submittedBy,
  children,
}: {
  id: string;
  title: string;
  meta: string;
  status: string;
  description?: string;
  submittedBy?: string;
  children?: ReactNode;
}) {
  const ticketNo = `#${id.slice(0, 6).toUpperCase()}`;
  const stubColor = STUB_COLOR[status] ?? "rgba(226, 137, 46, 0.35)";
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <li className="ticket ticket-row">
      <div className="ticket-notch-left" />

      <div className="ticket-body">
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
          {submittedBy && (
            <p className="text-xs font-body text-ink/50 mt-1">
              Diajukan oleh <span className="text-ink/70">{submittedBy}</span>
            </p>
          )}
          {description && (
            <p className="text-sm font-body text-ink/80 mt-3 whitespace-pre-wrap">
              {description}
            </p>
          )}
          {children && <div className="mt-4">{children}</div>}

          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="mt-4 font-mono text-[11px] uppercase tracking-wide text-amber-dark hover:text-ink"
          >
            {showTimeline ? "▾ Sembunyikan riwayat" : "▸ Lihat riwayat status"}
          </button>
          {showTimeline && (
            <div className="mt-3">
              <StatusTimeline requestId={id} />
            </div>
          )}
        </div>
      </div>

      <div
        className="ticket-stub"
        style={{ "--stub-color": stubColor } as CSSProperties}
      >
        <span className="ticket-stub-id">{ticketNo}</span>
        <span className="ticket-stub-id text-ink/30">ADM</span>
      </div>
    </li>
  );
}

import { SideRail } from "./SideRail";
import { StatusStamp, STATUS_META } from "./StatusStamp";

const STATUS_ORDER = ["pending", "approved", "rejected", "revision_requested"];

export function StatusLegendRail() {
  return (
    <SideRail eyebrow="Kode Status" title="Arti Setiap Stempel">
      <ul className="flex flex-col gap-3">
        {STATUS_ORDER.map((status) => (
          <li key={status} className="flex flex-col gap-1">
            <StatusStamp status={status} />
            <p className="text-xs font-body text-ink/60 leading-snug">
              {STATUS_META[status].meaning}
            </p>
          </li>
        ))}
      </ul>
    </SideRail>
  );
}

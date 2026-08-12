import { SideRail } from "./SideRail";

const GUIDE = [
  "Approve kalau request jelas & bisa langsung dikerjakan.",
  "Reject + catatan kalau emang di luar scope atau duplikat.",
  "Request revision + catatan kalau kurang detail, bukan langsung reject.",
  "Catatan wajib diisi buat reject & request revision — requester bakal baca itu.",
];

export function ReviewGuideRail() {
  return (
    <SideRail eyebrow="Ketentuan" title="Panduan Review">
      <ol className="flex flex-col gap-2.5 text-xs font-body text-ink/70 leading-relaxed">
        {GUIDE.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-ink/40">{i + 1}.</span>
            <span>{line}</span>
          </li>
        ))}
      </ol>
    </SideRail>
  );
}

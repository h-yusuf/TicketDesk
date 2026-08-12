import { RailCard } from "./SideRail";

const TIPS = [
  {
    title: "Jelaskan masalah secara spesifik",
    detail: 'Hindari "ada bug" tanpa detail.',
  },
  {
    title: "Sertakan screenshot / error log",
    detail: "Kalau ada tampilan error atau stack trace.",
  },
  {
    title: "Cantumkan halaman / fitur",
    detail: 'Contoh: "Halaman /dashboard/requests".',
  },
  {
    title: "Berikan dampak masalah",
    detail: 'Contoh: "User gak bisa submit request sejak kemarin".',
  },
  {
    title: "Lampirkan langkah reproduksi",
    detail: "Kalau ini bug, gimana cara munculinnya lagi.",
  },
];

export function TipsRequestCard() {
  return (
    <RailCard eyebrow="Tips Request" title="Agar Lebih Cepat Diproses">
      <ol className="flex flex-col gap-3 text-xs font-body text-ink/70 leading-relaxed">
        {TIPS.map((tip, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-ink/40">
              {String(i + 1).padStart(2, "0")}.
            </span>
            <span>
              <span className="text-ink font-medium">{tip.title}</span>
              <br />
              {tip.detail}
            </span>
          </li>
        ))}
      </ol>
    </RailCard>
  );
}

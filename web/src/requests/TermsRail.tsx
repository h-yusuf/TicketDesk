import { SideRail } from "./SideRail";

const TERMS = [
  "Judul singkat & spesifik — bukan cuma \"bug\" atau \"tolong dicek\".",
  "Pilih kategori yang paling sesuai, biar antre di tempat yang benar.",
  "Urgency jujur sesuai dampak nyata, bukan biar cepat diproses.",
  "Sertakan detail teknis: device, langkah reproduksi, atau pesan error.",
  "Kalau IT minta revisi, baca dulu catatannya sebelum edit ulang.",
];

export function TermsRail() {
  return (
    <SideRail eyebrow="Ketentuan" title="Sebelum Mengajukan">
      <ol className="flex flex-col gap-2.5 text-xs font-body text-ink/70 leading-relaxed">
        {TERMS.map((term, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-ink/40">{i + 1}.</span>
            <span>{term}</span>
          </li>
        ))}
      </ol>
    </SideRail>
  );
}

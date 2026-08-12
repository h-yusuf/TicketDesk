export const STATUS_META: Record<
  string,
  { label: string; className: string; meaning: string }
> = {
  pending: {
    label: "Pending",
    className: "border-slate-warm text-slate-warm",
    meaning: "Menunggu direview IT/Admin.",
  },
  approved: {
    label: "Approved",
    className: "border-sage text-sage",
    meaning: "Disetujui, lanjut diproses.",
  },
  rejected: {
    label: "Rejected",
    className: "border-rust text-rust",
    meaning: "Ditolak, gak diproses lebih lanjut.",
  },
  revision_requested: {
    label: "Revision",
    className: "border-violet text-violet",
    meaning: "Perlu diedit ulang requester sebelum direview lagi.",
  },
};

export function StatusStamp({ status }: { status: string }) {
  const style = STATUS_META[status] ?? {
    label: status.replace(/_/g, " "),
    className: "border-amber text-amber-dark",
  };

  return <span className={`stamp ${style.className}`}>{style.label}</span>;
}

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "border-slate-warm text-slate-warm" },
  approved: { label: "Approved", className: "border-sage text-sage" },
  rejected: { label: "Rejected", className: "border-rust text-rust" },
  revision_requested: {
    label: "Revision",
    className: "border-violet text-violet",
  },
};

export function StatusStamp({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? {
    label: status.replace(/_/g, " "),
    className: "border-amber text-amber-dark",
  };

  return <span className={`stamp ${style.className}`}>{style.label}</span>;
}

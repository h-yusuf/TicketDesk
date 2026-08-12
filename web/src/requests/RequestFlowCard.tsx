import { RailCard } from "./SideRail";

const STEPS = [
  { no: "01", title: "SUBMIT", detail: "Request dibuat oleh requester." },
  { no: "02", title: "REVIEW", detail: "IT/Admin memeriksa request." },
  { no: "03", title: "APPROVED", detail: "Disetujui, otomatis masuk Notion." },
  { no: "04", title: "DEVELOP", detail: "Dikerjain tim dev (Backlog → To Do → In Progress → In Review)." },
  { no: "05", title: "DONE", detail: "Request selesai dikerjain." },
];

export function RequestFlowCard() {
  return (
    <RailCard eyebrow="Alur Request" title="Dari Submit ke Done">
      <ol className="flex flex-col">
        {STEPS.map((step, i) => (
          <li key={step.no}>
            <div className="flex gap-2">
              <span className="font-mono text-xs text-amber-dark">{step.no}</span>
              <div>
                <p className="font-mono text-xs font-semibold tracking-wide text-ink">
                  {step.title}
                </p>
                <p className="text-xs font-body text-ink/60 leading-snug mt-0.5">
                  {step.detail}
                </p>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <p className="text-ink/25 text-xs ml-[7px] my-1">↓</p>
            )}
          </li>
        ))}
      </ol>
    </RailCard>
  );
}

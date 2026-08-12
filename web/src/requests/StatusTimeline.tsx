import { useEffect, useState } from "react";
import { pb } from "../pocketbase";

interface LogEntry {
  id: string;
  status: string;
  source: "pengajuan" | "pengerjaan";
  created: string;
}

function formatDate(iso: string): string {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function StatusTimeline({ requestId }: { requestId: string }) {
  const [logs, setLogs] = useState<LogEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    pb.collection("status_logs")
      .getFullList({ filter: `request = "${requestId}"`, sort: "created" })
      .then((records) => {
        if (!cancelled) setLogs(records as unknown as LogEntry[]);
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (logs === null) {
    return <p className="text-xs font-body text-ink/40">Memuat riwayat…</p>;
  }
  if (logs.length === 0) {
    return <p className="text-xs font-body text-ink/40">Belum ada riwayat status.</p>;
  }

  return (
    <ol className="flex flex-col gap-3 border-l border-dashed border-ink/20 pl-3">
      {logs.map((log) => (
        <li key={log.id} className="relative">
          <span className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-amber" />
          <p className="font-mono text-xs uppercase tracking-wide text-ink/70">
            {log.status}
            <span className="ml-2 text-ink/40">
              ({log.source === "pengerjaan" ? "Notion" : "ReqFlow"})
            </span>
          </p>
          <p className="text-[11px] font-body text-ink/40">{formatDate(log.created)}</p>
        </li>
      ))}
    </ol>
  );
}

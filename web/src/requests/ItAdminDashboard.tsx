import { useEffect, useState } from "react";
import { pb } from "../pocketbase";
import { pbErrorMessage } from "../pbError";
import { useAuth } from "../auth/AuthContext";
import { TicketCard } from "./TicketCard";
import { ReviewGuideRail } from "./ReviewGuideRail";
import { StatusLegendRail } from "./StatusLegendRail";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  category: string;
  description: string;
  urgency: string;
  requester: string;
  reviewNote: string | null;
  expand?: {
    requester?: { name?: string; email?: string };
  };
}

function requesterLabel(r: RequestRow): string {
  const requester = r.expand?.requester;
  return requester?.name || requester?.email || "unknown";
}

const DECISION_TO_STATUS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  request_revision: "revision_requested",
};

export function ItAdminDashboard() {
  const { user, signOut } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<
    Record<string, "reject" | "request_revision" | undefined>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("requests")
      .getFullList({ sort: "-created", expand: "requester" })
      .then((records) => {
        if (!cancelled) setRequests(records as unknown as RequestRow[]);
      });

    pb.collection("requests")
      .subscribe(
        "*",
        (e) => {
          setRequests((prev) => {
            const record = e.record as unknown as RequestRow;
            if (e.action === "delete") {
              return prev.filter((r) => r.id !== record.id);
            }
            if (prev.some((r) => r.id === record.id)) {
              return prev.map((r) => (r.id === record.id ? record : r));
            }
            return [record, ...prev];
          });
        },
        { expand: "requester" }
      )
      .then((fn) => {
        if (cancelled) fn();
        else unsubscribe = fn;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  async function review(
    requestId: string,
    decision: "approve" | "reject" | "request_revision"
  ) {
    setError(null);
    try {
      const note = notes[requestId]?.trim();
      await pb.collection("requests").update(requestId, {
        status: DECISION_TO_STATUS[decision],
        reviewedBy: user?.id,
        ...(note ? { reviewNote: note } : {}),
      });
      setPendingAction((prev) => ({ ...prev, [requestId]: undefined }));
    } catch (err) {
      setError(pbErrorMessage(err));
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 flex gap-8 justify-center">
      <ReviewGuideRail />

      <div className="w-full max-w-3xl">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-dark">
            Review Counter
          </p>
          <h1 className="font-display text-2xl font-bold mt-1">All Requests</h1>
        </div>
        <button
          onClick={() => signOut()}
          className="text-ink/40 hover:text-ink text-xs font-mono uppercase tracking-wide"
        >
          Sign out
        </button>
      </header>
      <div className="masthead-rule mb-8" />

      {error && <p className="text-rust text-sm font-body mb-4">{error}</p>}

      {requests.length === 0 ? (
        <p className="text-ink/40 font-body text-sm">
          Queue is empty — new requests will land here for review.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {requests.map((r) => (
            <TicketCard
              key={r.id}
              id={r.id}
              title={r.title}
              meta={`${r.category.replace(/_/g, " ")} · ${r.urgency} urgency`}
              status={r.status}
              description={r.description}
              submittedBy={requesterLabel(r)}
            >
              {r.status === "revision_requested" && (
                <div className="flex flex-col gap-2">
                  <div className="border-l-2 border-violet pl-3">
                    <p className="font-mono text-xs uppercase tracking-wide text-violet">
                      Our revision note
                    </p>
                    <p className="text-sm font-body text-ink/70 mt-1">
                      {r.reviewNote || "(no note left)"}
                    </p>
                  </div>
                  <p className="text-sm font-body text-ink/50 italic">
                    Waiting on requester to revise and resubmit.
                  </p>
                </div>
              )}
              {r.status === "pending" && !pendingAction[r.id] && (
                <div className="flex gap-2">
                  <button
                    onClick={() => review(r.id, "approve")}
                    className="bg-sage text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      setPendingAction((prev) => ({ ...prev, [r.id]: "reject" }))
                    }
                    className="bg-rust text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() =>
                      setPendingAction((prev) => ({
                        ...prev,
                        [r.id]: "request_revision",
                      }))
                    }
                    className="bg-violet text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Request revision
                  </button>
                </div>
              )}

              {r.status === "pending" && pendingAction[r.id] && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`note-${r.id}`}
                    className="font-mono text-xs uppercase tracking-wide text-ink/60"
                  >
                    Alasan {pendingAction[r.id] === "reject" ? "reject" : "request revision"}{" "}
                    (wajib diisi)
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    rows={2}
                    autoFocus
                    className="border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(r.id, pendingAction[r.id]!)}
                      disabled={!notes[r.id]?.trim()}
                      className={`font-display font-semibold text-xs rounded-sm px-3 py-1.5 text-paper hover:opacity-90 disabled:opacity-40 ${
                        pendingAction[r.id] === "reject" ? "bg-rust" : "bg-violet"
                      }`}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() =>
                        setPendingAction((prev) => ({ ...prev, [r.id]: undefined }))
                      }
                      className="border border-ink/20 text-ink/60 hover:text-ink font-display font-semibold text-xs rounded-sm px-3 py-1.5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </TicketCard>
          ))}
        </ul>
      )}
      </div>

      <StatusLegendRail />
    </div>
  );
}

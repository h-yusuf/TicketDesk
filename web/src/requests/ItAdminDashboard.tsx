import { useEffect, useState } from "react";
import { pb } from "../pocketbase";
import { pbErrorMessage } from "../pbError";
import { useAuth } from "../auth/AuthContext";
import { TicketCard } from "./TicketCard";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  category: string;
  urgency: string;
  requester: string;
  reviewNote: string | null;
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("requests")
      .getFullList({ sort: "-created" })
      .then((records) => {
        if (!cancelled) setRequests(records as unknown as RequestRow[]);
      });

    pb.collection("requests")
      .subscribe("*", (e) => {
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
      })
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
    } catch (err) {
      setError(pbErrorMessage(err));
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
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
              {r.status === "pending" ? (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor={`note-${r.id}`}
                    className="font-mono text-xs uppercase tracking-wide text-ink/60"
                  >
                    Note (required for reject / request revision)
                  </label>
                  <textarea
                    id={`note-${r.id}`}
                    value={notes[r.id] ?? ""}
                    onChange={(e) =>
                      setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    rows={2}
                    className="border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => review(r.id, "approve")}
                      className="bg-sage text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => review(r.id, "reject")}
                      disabled={!notes[r.id]?.trim()}
                      className="bg-rust text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => review(r.id, "request_revision")}
                      disabled={!notes[r.id]?.trim()}
                      className="bg-violet text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
                    >
                      Request revision
                    </button>
                  </div>
                </div>
              ) : null}
            </TicketCard>
          ))}
        </ul>
      )}
    </div>
  );
}

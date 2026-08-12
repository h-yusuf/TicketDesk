import { useEffect, useState } from "react";
import { pb } from "../pocketbase";
import { useAuth } from "../auth/AuthContext";
import { CreateRequestForm } from "./CreateRequestForm";
import { TicketCard } from "./TicketCard";
import { ReviseRequestForm } from "./ReviseRequestForm";
import { TermsRail } from "./TermsRail";
import { StatusLegendRail } from "./StatusLegendRail";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  category: string;
  description: string;
  urgency: string;
  reviewNote: string | null;
}

export function RequesterDashboard() {
  const { user, signOut } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [revisingId, setRevisingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const filter = `requester = "${user.id}"`;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    pb.collection("requests")
      .getFullList({ filter, sort: "-created" })
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
        { filter }
      )
      .then((fn) => {
        if (cancelled) fn();
        else unsubscribe = fn;
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 flex gap-8 justify-center">
      <TermsRail />

      <div className="w-full max-w-2xl">
        <header className="flex items-baseline justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-dark">
              My Queue
            </p>
            <h1 className="font-display text-2xl font-bold mt-1">Requests</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-amber hover:bg-amber-dark text-navy font-display font-semibold text-sm rounded-sm px-3 py-1.5 transition-colors"
            >
              {showForm ? "Close" : "New request"}
            </button>
            <button
              onClick={() => signOut()}
              className="text-ink/40 hover:text-ink text-xs font-mono uppercase tracking-wide"
            >
              Sign out
            </button>
          </div>
        </header>
        <div className="masthead-rule mb-8" />

        {showForm && (
          <div className="mb-8">
            <CreateRequestForm onCreated={() => setShowForm(false)} />
          </div>
        )}

        {requests.length === 0 ? (
          <p className="text-ink/40 font-body text-sm">
            No requests yet — submit one to start tracking it here.
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
                  <div className="flex flex-col gap-4">
                    <div className="border-l-2 border-violet pl-3">
                      <p className="font-mono text-xs uppercase tracking-wide text-violet">
                        Revision requested
                      </p>
                      <p className="text-sm font-body text-ink/70 mt-1">
                        {r.reviewNote || "IT/Admin asked for changes but left no note."}
                      </p>
                    </div>

                    {revisingId === r.id ? (
                      <ReviseRequestForm
                        request={r}
                        onResubmitted={() => setRevisingId(null)}
                        onCancel={() => setRevisingId(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setRevisingId(r.id)}
                        className="bg-violet text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90 self-start"
                      >
                        Revisi
                      </button>
                    )}
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

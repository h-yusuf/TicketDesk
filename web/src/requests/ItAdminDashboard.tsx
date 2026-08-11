import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { TicketCard } from "./TicketCard";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  category: string;
  urgency: string;
  requesterId: string;
}

export function ItAdminDashboard() {
  const { signOut } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(collection(db, "requests"), (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestRow, "id">) }))
      );
    });
  }, []);

  async function review(requestId: string, decision: "approve" | "reject" | "request_revision") {
    setError(null);
    try {
      const reviewRequest = httpsCallable(functions, "reviewRequest");
      await reviewRequest({ requestId, decision });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review action failed.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <header className="flex items-baseline justify-between mb-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber">
            Review Counter
          </p>
          <h1 className="font-display text-2xl font-bold mt-1">All Requests</h1>
        </div>
        <button
          onClick={() => signOut()}
          className="text-paper/40 hover:text-paper text-xs font-mono uppercase tracking-wide"
        >
          Sign out
        </button>
      </header>

      {error && <p className="text-rust text-sm font-body mb-4">{error}</p>}

      {requests.length === 0 ? (
        <p className="text-paper/40 font-body text-sm">
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
              {r.status === "pending" || r.status === "revision_requested" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => review(r.id, "approve")}
                    className="bg-sage text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(r.id, "reject")}
                    className="bg-rust text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => review(r.id, "request_revision")}
                    className="bg-violet text-paper font-display font-semibold text-xs rounded-sm px-3 py-1.5 hover:opacity-90"
                  >
                    Request revision
                  </button>
                </div>
              ) : null}
            </TicketCard>
          ))}
        </ul>
      )}
    </div>
  );
}

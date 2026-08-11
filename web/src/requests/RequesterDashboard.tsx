import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { CreateRequestForm } from "./CreateRequestForm";
import { TicketCard } from "./TicketCard";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  category: string;
  urgency: string;
}

export function RequesterDashboard() {
  const { user, signOut } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "requests"), where("requesterId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setRequests(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RequestRow, "id">) }))
      );
    });
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <header className="flex items-baseline justify-between mb-8">
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
            />
          ))}
        </ul>
      )}
    </div>
  );
}

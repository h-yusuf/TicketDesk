import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../firebase";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  requesterId: string;
}

export function ItAdminDashboard() {
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
    <div className="max-w-3xl mx-auto mt-8">
      <h1 className="text-xl font-semibold mb-4">All Requests</h1>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="border rounded p-3 flex justify-between items-center">
            <span>
              {r.title} <span className="text-sm text-gray-600">({r.status})</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => review(r.id, "approve")}
                className="bg-green-600 text-white rounded px-2 py-1 text-sm"
              >
                Approve
              </button>
              <button
                onClick={() => review(r.id, "reject")}
                className="bg-red-600 text-white rounded px-2 py-1 text-sm"
              >
                Reject
              </button>
              <button
                onClick={() => review(r.id, "request_revision")}
                className="bg-yellow-600 text-white rounded px-2 py-1 text-sm"
              >
                Request Revision
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

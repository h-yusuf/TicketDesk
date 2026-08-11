import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth/AuthContext";
import { CreateRequestForm } from "./CreateRequestForm";

interface RequestRow {
  id: string;
  title: string;
  status: string;
  urgency: string;
}

export function RequesterDashboard() {
  const { user } = useAuth();
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
    <div className="max-w-2xl mx-auto mt-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-semibold">My Requests</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white rounded px-3 py-1"
        >
          {showForm ? "Close" : "New Request"}
        </button>
      </div>

      {showForm && (
        <div className="mb-6">
          <CreateRequestForm onCreated={() => setShowForm(false)} />
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {requests.map((r) => (
          <li key={r.id} className="border rounded p-3 flex justify-between">
            <span>{r.title}</span>
            <span className="text-sm text-gray-600">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

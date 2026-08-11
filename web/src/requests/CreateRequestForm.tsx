import { type FormEvent, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const CATEGORIES = [
  { value: "feature_request", label: "Request Baru" },
  { value: "bug_fix", label: "Perbaikan Bug" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Lainnya" },
];
const URGENCIES = ["low", "medium", "high"];

export function CreateRequestForm({
  onCreated,
}: {
  onCreated: (requestId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState(URGENCIES[0]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const createRequest = httpsCallable(functions, "createRequest");
      const result = (await createRequest({
        title,
        category,
        description,
        urgency,
      })) as { data: { requestId: string } };
      onCreated(result.data.requestId);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
      <label htmlFor="title">Title</label>
      <input
        id="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border rounded px-2 py-1"
      />

      <label htmlFor="category">Category</label>
      <select
        id="category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border rounded px-2 py-1"
      >
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <label htmlFor="description">Description</label>
      <textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="border rounded px-2 py-1"
      />

      <label htmlFor="urgency">Urgency</label>
      <select
        id="urgency"
        value={urgency}
        onChange={(e) => setUrgency(e.target.value)}
        className="border rounded px-2 py-1"
      >
        {URGENCIES.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-blue-600 text-white rounded px-3 py-1"
      >
        Submit
      </button>
    </form>
  );
}

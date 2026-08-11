import { type FormEvent, useState } from "react";
import { doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";

const CATEGORIES = [
  { value: "feature_request", label: "Request Baru" },
  { value: "bug_fix", label: "Perbaikan Bug" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Lainnya" },
];
const URGENCIES = ["low", "medium", "high"];

interface RequestData {
  id: string;
  title: string;
  category: string;
  description: string;
  urgency: string;
}

export function ReviseRequestForm({
  request,
  onResubmitted,
}: {
  request: RequestData;
  onResubmitted: () => void;
}) {
  const [title, setTitle] = useState(request.title);
  const [category, setCategory] = useState(request.category);
  const [description, setDescription] = useState(request.description);
  const [urgency, setUrgency] = useState(request.urgency);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldClass =
    "border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber";
  const labelClass = "font-mono text-xs uppercase tracking-wide text-ink/60";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "requests", request.id), {
        title: title.trim(),
        category,
        description: description.trim(),
        urgency,
        status: "pending",
        reviewNote: null,
        updatedAt: Timestamp.now(),
      });
      onResubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resubmit request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor={`title-${request.id}`} className={labelClass}>Title</label>
      <input
        id={`title-${request.id}`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className={fieldClass}
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`category-${request.id}`} className={labelClass}>Category</label>
          <select
            id={`category-${request.id}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={fieldClass}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`urgency-${request.id}`} className={labelClass}>Urgency</label>
          <select
            id={`urgency-${request.id}`}
            value={urgency}
            onChange={(e) => setUrgency(e.target.value)}
            className={fieldClass}
          >
            {URGENCIES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label htmlFor={`description-${request.id}`} className={labelClass}>Description</label>
      <textarea
        id={`description-${request.id}`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        className={fieldClass}
      />

      {error && <p className="text-rust text-sm font-body">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-navy font-display font-semibold text-sm rounded-sm px-3 py-1.5 transition-colors self-start"
      >
        {submitting ? "Resubmitting…" : "Resubmit request"}
      </button>
    </form>
  );
}

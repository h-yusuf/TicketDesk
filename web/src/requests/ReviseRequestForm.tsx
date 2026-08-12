import { type FormEvent, useState } from "react";
import { pb } from "../pocketbase";
import { pbErrorMessage } from "../pbError";

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
  onCancel,
}: {
  request: RequestData;
  onResubmitted: () => void;
  onCancel: () => void;
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
      await pb.collection("requests").update(request.id, {
        title: title.trim(),
        category,
        description: description.trim(),
        urgency,
        status: "pending",
        reviewNote: "",
      });
      onResubmitted();
    } catch (err) {
      setError(pbErrorMessage(err));
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-amber hover:bg-amber-dark disabled:opacity-50 text-navy font-display font-semibold text-sm rounded-sm px-3 py-1.5 transition-colors"
        >
          {submitting ? "Resubmitting…" : "Resubmit request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-ink/20 text-ink/60 hover:text-ink font-display font-semibold text-sm rounded-sm px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

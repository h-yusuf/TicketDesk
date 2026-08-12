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
    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      const record = await pb.collection("requests").create({
        requester: pb.authStore.model?.id,
        title: title.trim(),
        category,
        description: description.trim(),
        urgency,
        status: "pending",
      });
      onCreated(record.id);
      setTitle("");
      setDescription("");
    } catch (err) {
      setError(pbErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "border border-ink/20 rounded-sm bg-transparent px-3 py-2 font-body text-sm focus:outline-none focus:ring-2 focus:ring-amber";
  const labelClass = "font-mono text-xs uppercase tracking-wide text-ink/60";

  return (
    <div className="ticket">
      <div className="ticket-notch-left" />

      <div className="flex items-baseline justify-between px-6 pt-4">
        <span className="font-mono text-xs tracking-wide text-ink/50">
          REQUEST SLIP
        </span>
        <span className="font-mono text-xs tracking-wide text-amber-dark">
          NO. {Date.now().toString().slice(-6)}
        </span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="ticket-perforation px-6 pt-4 pb-6 flex flex-col gap-3"
      >
        <label htmlFor="title" className={labelClass}>Title</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={fieldClass}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className={labelClass}>Category</label>
            <select
              id="category"
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
            <label htmlFor="urgency" className={labelClass}>Urgency</label>
            <select
              id="urgency"
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

        <label htmlFor="description" className={labelClass}>Description</label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className={fieldClass}
        />

        {error && <p className="text-rust text-sm font-body">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 bg-amber hover:bg-amber-dark disabled:opacity-50 text-navy font-display font-semibold rounded-sm px-3 py-2 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit request"}
        </button>
      </form>
    </div>
  );
}

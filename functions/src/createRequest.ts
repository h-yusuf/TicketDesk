import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const CATEGORIES = ["hardware", "software", "access", "other"];
const URGENCIES = ["low", "medium", "high"];

interface CreateRequestInput {
  title: string;
  category: string;
  description: string;
  urgency: string;
}

export const createRequest = onCall<CreateRequestInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { title, category, description, urgency } = request.data;

  if (!title || !title.trim()) {
    throw new HttpsError("invalid-argument", "Title is required.");
  }
  if (!description || !description.trim()) {
    throw new HttpsError("invalid-argument", "Description is required.");
  }
  if (!CATEGORIES.includes(category)) {
    throw new HttpsError("invalid-argument", "Invalid category.");
  }
  if (!URGENCIES.includes(urgency)) {
    throw new HttpsError("invalid-argument", "Invalid urgency.");
  }

  const db = admin.firestore();
  const ref = db.collection("requests").doc();
  const now = admin.firestore.Timestamp.now();

  await ref.set({
    requesterId: request.auth.uid,
    title: title.trim(),
    category,
    description: description.trim(),
    urgency,
    status: "pending",
    reviewedBy: null,
    reviewNote: null,
    notionPageId: null,
    createdAt: now,
    updatedAt: now,
  });

  return { requestId: ref.id };
});

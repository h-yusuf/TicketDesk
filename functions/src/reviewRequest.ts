import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

const DECISION_TO_STATUS: Record<string, string> = {
  approve: "approved",
  reject: "rejected",
  request_revision: "revision_requested",
};

interface ReviewRequestInput {
  requestId: string;
  decision: string;
  note?: string;
}

export const reviewRequest = onCall<ReviewRequestInput>(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const db = admin.firestore();
  const callerDoc = await db.collection("users").doc(request.auth.uid).get();
  if (callerDoc.data()?.role !== "it_admin") {
    throw new HttpsError("permission-denied", "Only IT/Admin can review requests.");
  }

  const { requestId, decision, note } = request.data;
  const status = DECISION_TO_STATUS[decision];
  if (!status) {
    throw new HttpsError("invalid-argument", "Invalid decision.");
  }

  const ref = db.collection("requests").doc(requestId);
  await ref.update({
    status,
    reviewedBy: request.auth.uid,
    reviewNote: note ?? null,
    updatedAt: admin.firestore.Timestamp.now(),
  });

  return { status };
});

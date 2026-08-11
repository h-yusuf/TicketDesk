import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

export const bootstrapUser = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();
  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();

  if (existing.exists) {
    return { role: existing.data()?.role ?? "requester" };
  }

  await userRef.set({
    email: request.auth.token.email ?? null,
    displayName: request.auth.token.name ?? null,
    role: "requester",
    createdAt: admin.firestore.Timestamp.now(),
  });

  return { role: "requester" };
});

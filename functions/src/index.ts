import * as admin from "firebase-admin";
admin.initializeApp();

export { bootstrapUser } from "./bootstrapUser";
export { createRequest } from "./createRequest";
export { reviewRequest } from "./reviewRequest";

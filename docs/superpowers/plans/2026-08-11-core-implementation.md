# ReqFlow Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Core sub-project of ReqFlow — auth, user bootstrap, request create/review lifecycle, Firestore schema and security rules, requester + IT/Admin dashboards.

**Architecture:** React + Vite + Tailwind SPA (`web/`) talking to Firebase Auth + Firestore directly for reads, and to Firebase Cloud Functions v2 (TypeScript, `functions/`) callables for validated writes. Firestore security rules are the hard enforcement boundary for ownership/role. No dedicated backend server.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, Firebase Auth (email/password + Google), Firestore, Firebase Functions v2 (TS), Firebase Hosting, Jest + Firebase Emulator Suite, `@firebase/rules-unit-testing`, React Testing Library.

## Global Constraints

- Fully serverless — no dedicated backend server (per spec section 1).
- Firestore security rules enforce ownership/role; callables re-validate server-side too (per spec section 4).
- Exactly two roles: `requester` (default on signup), `it_admin` (assigned manually, never self-service) (per spec section 3).
- Cloud Functions written in TypeScript, Functions v2 (per spec section 1).
- `status` enum before approval: `pending` | `revision_requested` | `rejected` | `approved`. After `approved`, `status` becomes a free-form Notion-synced string — out of scope for Core, but the field must accept arbitrary strings (per spec section 2).
- Frontend must not silently reset form input on write failure (per spec section 4).

---

### Task 1: Project Scaffold (Firebase + Vite monorepo)

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `firebase.json`
- Create: `.firebaserc`
- Create: `firestore.rules`
- Create: `firestore.indexes.json`
- Create: `web/` (Vite React-TS app, scaffolded)
- Create: `functions/` (Functions v2 TS app, scaffolded)

**Interfaces:**
- Produces: root workspace running `npm run build` (builds `web/`) and `npm --workspace functions run build` (compiles functions). Later tasks assume both exist and build cleanly.

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "reqflow",
  "private": true,
  "workspaces": ["web", "functions"],
  "scripts": {
    "dev": "npm --workspace web run dev",
    "build": "npm --workspace web run build",
    "emulators": "firebase emulators:start"
  }
}
```

- [ ] **Step 2: Create root .gitignore**

```
node_modules/
dist/
lib/
.firebase/
*.local
.env
```

- [ ] **Step 3: Scaffold the web app**

Run: `npm create vite@latest web -- --template react-ts`

Then inside `web/`, install Tailwind:

Run: `cd web && npm install && npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p && cd ..`

Edit `web/tailwind.config.js` `content` array to `["./index.html", "./src/**/*.{ts,tsx}"]`.

Replace `web/src/index.css` contents with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Scaffold Cloud Functions**

Run: `npx firebase-tools@latest init functions` and choose: existing directory `functions`, TypeScript, no ESLint (keep scope tight), don't install now.

Run: `cd functions && npm install firebase-admin firebase-functions && npm install -D typescript jest ts-jest @types/jest firebase-functions-test @firebase/rules-unit-testing && cd ..`

Edit `functions/package.json` scripts to add:

```json
"test": "jest"
```

Create `functions/jest.config.js`:

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
};
```

- [ ] **Step 5: Create firebase.json**

```json
{
  "hosting": {
    "public": "web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "codebase": "default",
    "runtime": "nodejs20"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "functions": { "port": 5001 },
    "hosting": { "port": 5000 },
    "ui": { "enabled": true }
  }
}
```

- [ ] **Step 6: Create .firebaserc (placeholder project id)**

```json
{
  "projects": {
    "default": "reqflow-dev"
  }
}
```

- [ ] **Step 7: Create placeholder firestore.rules and firestore.indexes.json**

`firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`firestore.indexes.json`:

```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 8: Verify build**

Run: `npm install && npm run build`
Expected: Vite build succeeds, outputs `web/dist/`.

Run: `cd functions && npm run build && cd ..`
Expected: TypeScript compiles with no errors (empty/default `functions/src/index.ts` is fine at this point).

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore firebase.json .firebaserc firestore.rules firestore.indexes.json web functions
git commit -m "chore: scaffold Firebase + Vite monorepo for ReqFlow Core"
```

---

### Task 2: User Bootstrap Callable (`bootstrapUser`)

**Files:**
- Create: `functions/src/bootstrapUser.ts`
- Create: `functions/src/bootstrapUser.test.ts`
- Modify: `functions/src/index.ts` (export `bootstrapUser`)

**Interfaces:**
- Consumes: `firebase-admin` Firestore instance, `firebase-functions/v2/https` `onCall`.
- Produces: callable `bootstrapUser(data: {}, context)` → `{ role: "requester" | "it_admin" }`. Creates `users/{uid}` doc `{ email, displayName, role: "requester", createdAt }` if absent; if present, returns existing role unchanged. Called by frontend immediately after every successful login/signup.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/bootstrapUser.test.ts
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

describe("bootstrapUser", () => {
  let bootstrapUser: any;

  beforeAll(() => {
    admin.initializeApp({ projectId: "reqflow-test" });
    bootstrapUser = require("./bootstrapUser").bootstrapUser;
  });

  afterAll(async () => {
    testEnv.cleanup();
    await admin.app().delete();
  });

  it("creates a users doc with role requester on first call", async () => {
    const wrapped = testEnv.wrap(bootstrapUser);
    const result = await wrapped(
      {},
      {
        auth: { uid: "user-1", token: { email: "a@example.com", name: "Alice" } },
      }
    );
    expect(result).toEqual({ role: "requester" });

    const doc = await admin.firestore().collection("users").doc("user-1").get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.role).toBe("requester");
  });

  it("returns existing role without overwriting on repeat call", async () => {
    await admin.firestore().collection("users").doc("user-2").set({
      email: "b@example.com",
      displayName: "Bob",
      role: "it_admin",
      createdAt: admin.firestore.Timestamp.now(),
    });

    const wrapped = testEnv.wrap(bootstrapUser);
    const result = await wrapped(
      {},
      { auth: { uid: "user-2", token: { email: "b@example.com", name: "Bob" } } }
    );
    expect(result).toEqual({ role: "it_admin" });
  });

  it("throws unauthenticated if no auth context", async () => {
    const wrapped = testEnv.wrap(bootstrapUser);
    await expect(wrapped({}, {})).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `functions/`, against Firestore emulator): `firebase emulators:exec --only firestore "npm test -- bootstrapUser.test.ts"`
Expected: FAIL — `Cannot find module './bootstrapUser'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/bootstrapUser.ts
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
```

Update `functions/src/index.ts`:

```typescript
import * as admin from "firebase-admin";
admin.initializeApp();

export { bootstrapUser } from "./bootstrapUser";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `firebase emulators:exec --only firestore "npm test -- bootstrapUser.test.ts"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/bootstrapUser.ts functions/src/bootstrapUser.test.ts functions/src/index.ts
git commit -m "feat: add bootstrapUser callable for default role assignment"
```

---

### Task 3: Firestore Security Rules (ownership + role enforcement)

**Files:**
- Modify: `firestore.rules`
- Create: `firestore.rules.test.ts` (root-level, uses `@firebase/rules-unit-testing`)
- Create: `package.json` root — add `@firebase/rules-unit-testing`, `jest`, `ts-jest` as devDependencies and a `test:rules` script

**Interfaces:**
- Consumes: `users/{uid}.role` field from Task 2, `requests/{id}` schema from spec section 2.
- Produces: enforced rules that Task 4/5 callables rely on as the DB-level backstop.

- [ ] **Step 1: Add rules test tooling to root**

Run: `npm install -D @firebase/rules-unit-testing jest ts-jest @types/jest typescript`

Create root `jest.config.js`:

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/firestore.rules.test.ts"],
};
```

Add to root `package.json` scripts: `"test:rules": "firebase emulators:exec --only firestore \"jest --config jest.config.js\""`

- [ ] **Step 2: Write the failing test**

```typescript
// firestore.rules.test.ts
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { setDoc, doc, getDoc, updateDoc } from "firebase/firestore";
import * as fs from "fs";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "reqflow-rules-test",
    firestore: { rules: fs.readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "users/requester-1"), {
      email: "r1@example.com",
      role: "requester",
    });
    await setDoc(doc(ctx.firestore(), "users/it-1"), {
      email: "it1@example.com",
      role: "it_admin",
    });
    await setDoc(doc(ctx.firestore(), "requests/req-1"), {
      requesterId: "requester-1",
      title: "New laptop",
      category: "hardware",
      description: "Need one",
      urgency: "low",
      status: "pending",
    });
  });
});

test("owner can read their own request", async () => {
  const ctx = testEnv.authenticatedContext("requester-1");
  await assertSucceeds(getDoc(doc(ctx.firestore(), "requests/req-1")));
});

test("non-owner requester cannot read another's request", async () => {
  const ctx = testEnv.authenticatedContext("requester-2");
  await assertFails(getDoc(doc(ctx.firestore(), "requests/req-1")));
});

test("it_admin can read any request", async () => {
  const ctx = testEnv.authenticatedContext("it-1");
  await assertSucceeds(getDoc(doc(ctx.firestore(), "requests/req-1")));
});

test("owner can edit their request while status is revision_requested", async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), "requests/req-1"), {
      status: "revision_requested",
    });
  });
  const ctx = testEnv.authenticatedContext("requester-1");
  await assertSucceeds(
    updateDoc(doc(ctx.firestore(), "requests/req-1"), { description: "Updated" })
  );
});

test("owner cannot edit their request while status is pending", async () => {
  const ctx = testEnv.authenticatedContext("requester-1");
  await assertFails(
    updateDoc(doc(ctx.firestore(), "requests/req-1"), { description: "Sneaky edit" })
  );
});

test("requester cannot self-approve", async () => {
  const ctx = testEnv.authenticatedContext("requester-1");
  await assertFails(
    updateDoc(doc(ctx.firestore(), "requests/req-1"), { status: "approved" })
  );
});

test("it_admin can set status to approved", async () => {
  const ctx = testEnv.authenticatedContext("it-1");
  await assertSucceeds(
    updateDoc(doc(ctx.firestore(), "requests/req-1"), { status: "approved" })
  );
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — all `assertSucceeds` calls fail because current `firestore.rules` denies everything.

- [ ] **Step 4: Write minimal implementation**

```
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function role() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isItAdmin() {
      return isSignedIn() && role() == "it_admin";
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isItAdmin());
      allow write: if false; // only Cloud Functions (admin SDK) write user docs
    }

    match /requests/{requestId} {
      allow read: if isSignedIn() &&
        (resource.data.requesterId == request.auth.uid || isItAdmin());

      allow create: if isSignedIn() &&
        request.resource.data.requesterId == request.auth.uid &&
        request.resource.data.status == "pending";

      allow update: if isSignedIn() && (
        (isItAdmin()) ||
        (
          resource.data.requesterId == request.auth.uid &&
          resource.data.status == "revision_requested" &&
          request.resource.data.status == "pending" &&
          request.resource.data.requesterId == resource.data.requesterId
        )
      );

      allow delete: if false;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:rules`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.rules.test.ts jest.config.js package.json package-lock.json
git commit -m "feat: enforce request ownership and role rules in Firestore"
```

---

### Task 4: `createRequest` Callable

**Files:**
- Create: `functions/src/createRequest.ts`
- Create: `functions/src/createRequest.test.ts`
- Modify: `functions/src/index.ts` (export `createRequest`)

**Interfaces:**
- Consumes: `admin.firestore()` from Task 2/3's data model.
- Produces: callable `createRequest(data: { title: string; category: string; description: string; urgency: string }, context)` → `{ requestId: string }`. Validates input server-side, writes `requests/{id}` with `status: "pending"`.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/createRequest.test.ts
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

describe("createRequest", () => {
  let createRequest: any;

  beforeAll(() => {
    if (admin.apps.length === 0) admin.initializeApp({ projectId: "reqflow-test" });
    createRequest = require("./createRequest").createRequest;
  });

  afterAll(async () => {
    testEnv.cleanup();
  });

  it("creates a request with status pending for a valid payload", async () => {
    const wrapped = testEnv.wrap(createRequest);
    const result = await wrapped(
      {
        title: "New laptop",
        category: "hardware",
        description: "Current one is broken",
        urgency: "high",
      },
      { auth: { uid: "requester-9", token: {} } }
    );

    expect(result.requestId).toBeDefined();
    const doc = await admin.firestore().collection("requests").doc(result.requestId).get();
    expect(doc.data()).toMatchObject({
      requesterId: "requester-9",
      title: "New laptop",
      category: "hardware",
      description: "Current one is broken",
      urgency: "high",
      status: "pending",
    });
  });

  it("rejects missing title", async () => {
    const wrapped = testEnv.wrap(createRequest);
    await expect(
      wrapped(
        { title: "", category: "hardware", description: "x", urgency: "low" },
        { auth: { uid: "requester-9", token: {} } }
      )
    ).rejects.toThrow();
  });

  it("rejects invalid category", async () => {
    const wrapped = testEnv.wrap(createRequest);
    await expect(
      wrapped(
        { title: "x", category: "not-a-category", description: "x", urgency: "low" },
        { auth: { uid: "requester-9", token: {} } }
      )
    ).rejects.toThrow();
  });

  it("rejects unauthenticated calls", async () => {
    const wrapped = testEnv.wrap(createRequest);
    await expect(
      wrapped({ title: "x", category: "hardware", description: "x", urgency: "low" }, {})
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `firebase emulators:exec --only firestore "npm test -- createRequest.test.ts"` (from `functions/`)
Expected: FAIL — `Cannot find module './createRequest'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/createRequest.ts
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
```

Update `functions/src/index.ts`:

```typescript
export { createRequest } from "./createRequest";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `firebase emulators:exec --only firestore "npm test -- createRequest.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/createRequest.ts functions/src/createRequest.test.ts functions/src/index.ts
git commit -m "feat: add createRequest callable with server-side validation"
```

---

### Task 5: `reviewRequest` Callable

**Files:**
- Create: `functions/src/reviewRequest.ts`
- Create: `functions/src/reviewRequest.test.ts`
- Modify: `functions/src/index.ts` (export `reviewRequest`)

**Interfaces:**
- Consumes: `requests/{id}` doc shape from Task 4, `users/{uid}.role` from Task 2.
- Produces: callable `reviewRequest(data: { requestId: string; decision: "approve"|"reject"|"request_revision"; note?: string }, context)` → `{ status: string }`. Only callable by `it_admin`.

- [ ] **Step 1: Write the failing test**

```typescript
// functions/src/reviewRequest.test.ts
import * as admin from "firebase-admin";
import functionsTest from "firebase-functions-test";

const testEnv = functionsTest();

describe("reviewRequest", () => {
  let reviewRequest: any;

  beforeAll(() => {
    if (admin.apps.length === 0) admin.initializeApp({ projectId: "reqflow-test" });
    reviewRequest = require("./reviewRequest").reviewRequest;
  });

  afterAll(async () => {
    testEnv.cleanup();
  });

  async function seedRequest(id: string) {
    await admin.firestore().collection("requests").doc(id).set({
      requesterId: "requester-1",
      title: "x",
      category: "hardware",
      description: "x",
      urgency: "low",
      status: "pending",
      reviewedBy: null,
      reviewNote: null,
      notionPageId: null,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  }

  async function seedItAdmin(uid: string) {
    await admin.firestore().collection("users").doc(uid).set({
      email: "it@example.com",
      role: "it_admin",
    });
  }

  async function seedRequester(uid: string) {
    await admin.firestore().collection("users").doc(uid).set({
      email: "r@example.com",
      role: "requester",
    });
  }

  it("it_admin can approve a pending request", async () => {
    await seedItAdmin("it-1");
    await seedRequester("requester-1");
    await seedRequest("req-approve");

    const wrapped = testEnv.wrap(reviewRequest);
    const result = await wrapped(
      { requestId: "req-approve", decision: "approve" },
      { auth: { uid: "it-1", token: {} } }
    );

    expect(result).toEqual({ status: "approved" });
  });

  it("it_admin can request revision with a note", async () => {
    await seedRequest("req-revise");
    const wrapped = testEnv.wrap(reviewRequest);
    const result = await wrapped(
      { requestId: "req-revise", decision: "request_revision", note: "Add more detail" },
      { auth: { uid: "it-1", token: {} } }
    );
    expect(result).toEqual({ status: "revision_requested" });

    const doc = await admin.firestore().collection("requests").doc("req-revise").get();
    expect(doc.data()?.reviewNote).toBe("Add more detail");
  });

  it("requester cannot call reviewRequest", async () => {
    await seedRequest("req-blocked");
    const wrapped = testEnv.wrap(reviewRequest);
    await expect(
      wrapped(
        { requestId: "req-blocked", decision: "approve" },
        { auth: { uid: "requester-1", token: {} } }
      )
    ).rejects.toThrow();
  });

  it("rejects invalid decision value", async () => {
    await seedRequest("req-invalid");
    const wrapped = testEnv.wrap(reviewRequest);
    await expect(
      wrapped(
        { requestId: "req-invalid", decision: "maybe" },
        { auth: { uid: "it-1", token: {} } }
      )
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `firebase emulators:exec --only firestore "npm test -- reviewRequest.test.ts"` (from `functions/`)
Expected: FAIL — `Cannot find module './reviewRequest'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// functions/src/reviewRequest.ts
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
```

Update `functions/src/index.ts`:

```typescript
export { reviewRequest } from "./reviewRequest";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `firebase emulators:exec --only firestore "npm test -- reviewRequest.test.ts"`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/reviewRequest.ts functions/src/reviewRequest.test.ts functions/src/index.ts
git commit -m "feat: add reviewRequest callable restricted to it_admin"
```

---

### Task 6: Frontend Firebase Init + Auth Context

**Files:**
- Create: `web/src/firebase.ts`
- Create: `web/src/auth/AuthContext.tsx`
- Create: `web/src/auth/AuthContext.test.tsx`
- Create: `web/.env.example`
- Modify: `web/src/main.tsx` (wrap app in `AuthProvider`)

**Interfaces:**
- Produces: `useAuth()` hook → `{ user: FirebaseUser | null, role: "requester"|"it_admin"|null, loading: boolean, signInEmail(email,pw), signUpEmail(email,pw), signInGoogle(), signOut() }`. Later frontend tasks (7, 8, 9) consume `useAuth()`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/auth/AuthContext.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";

jest.mock("../firebase", () => ({
  auth: {},
  db: {},
  functions: {},
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: any, cb: any) => {
    cb(null);
    return () => {};
  },
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  GoogleAuthProvider: jest.fn(),
  signOut: jest.fn(),
}));

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? "signed-in" : "signed-out"}</div>;
}

test("resolves to signed-out when no auth user", async () => {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
  await waitFor(() => screen.getByText("signed-out"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `web/`): `npm install -D @testing-library/react @testing-library/jest-dom jest jest-environment-jsdom ts-jest @types/jest identity-obj-proxy && npx jest src/auth/AuthContext.test.tsx`
Expected: FAIL — `Cannot find module './AuthContext'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// web/src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
```

```
# web/.env.example
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

```tsx
// web/src/auth/AuthContext.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
  User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebase";

type Role = "requester" | "it_admin" | null;

interface AuthValue {
  user: User | null;
  role: Role;
  loading: boolean;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

async function bootstrapAndFetchRole(): Promise<Role> {
  const bootstrap = httpsCallable(functions, "bootstrapUser");
  const result = (await bootstrap({})) as { data: { role: Role } };
  return result.data.role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const r = await bootstrapAndFetchRole();
        setRole(r);
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value: AuthValue = {
    user,
    role,
    loading,
    signInEmail: async (email, password) => {
      await signInWithEmailAndPassword(auth, email, password);
    },
    signUpEmail: async (email, password) => {
      await createUserWithEmailAndPassword(auth, email, password);
    },
    signInGoogle: async () => {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    signOut: async () => {
      await fbSignOut(auth);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

Add `web/src/setupTests.ts`:

```typescript
import "@testing-library/jest-dom";
```

Add `web/jest.config.js`:

```js
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  moduleNameMapper: { "\\.css$": "identity-obj-proxy" },
};
```

Update `web/src/main.tsx` to wrap `<App />` with `<AuthProvider>`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/AuthContext.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/firebase.ts web/src/auth web/.env.example web/jest.config.js web/src/setupTests.ts web/src/main.tsx web/package.json web/package-lock.json
git commit -m "feat: add Firebase client init and AuthContext with bootstrapUser call"
```

---

### Task 7: Login / Signup Page

**Files:**
- Create: `web/src/auth/LoginPage.tsx`
- Create: `web/src/auth/LoginPage.test.tsx`
- Modify: `web/src/App.tsx` (route to `LoginPage` when signed out)

**Interfaces:**
- Consumes: `useAuth()` from Task 6 (`signInEmail`, `signUpEmail`, `signInGoogle`).
- Produces: `<LoginPage />` component, no props.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/auth/LoginPage.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginPage } from "./LoginPage";
import { useAuth } from "./AuthContext";

jest.mock("./AuthContext");

test("shows validation error when submitting empty form", () => {
  (useAuth as jest.Mock).mockReturnValue({
    signInEmail: jest.fn(),
    signUpEmail: jest.fn(),
    signInGoogle: jest.fn(),
  });
  render(<LoginPage />);
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));
  expect(screen.getByText(/email and password are required/i)).toBeInTheDocument();
});

test("calls signInEmail with entered credentials and keeps input on failure", async () => {
  const signInEmail = jest.fn().mockRejectedValue(new Error("bad creds"));
  (useAuth as jest.Mock).mockReturnValue({
    signInEmail,
    signUpEmail: jest.fn(),
    signInGoogle: jest.fn(),
  });
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@b.com" } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: /log in/i }));

  await screen.findByText(/bad creds/i);
  expect(signInEmail).toHaveBeenCalledWith("a@b.com", "secret");
  expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe("a@b.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/auth/LoginPage.test.tsx`
Expected: FAIL — `Cannot find module './LoginPage'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/auth/LoginPage.tsx
import { FormEvent, useState } from "react";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { signInEmail, signUpEmail, signInGoogle } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("login");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    try {
      if (mode === "login") {
        await signInEmail(email, password);
      } else {
        await signUpEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-16 p-6 border rounded">
      <h1 className="text-xl font-semibold mb-4">ReqFlow</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border rounded px-2 py-1"
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="bg-blue-600 text-white rounded px-3 py-1">
          {mode === "login" ? "Log in" : "Sign up"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="text-sm text-blue-600 mt-2"
      >
        {mode === "login" ? "Need an account? Sign up" : "Have an account? Log in"}
      </button>
      <button
        type="button"
        onClick={() => signInGoogle().catch((err) => setError(err.message))}
        className="mt-4 border rounded px-3 py-1 w-full"
      >
        Continue with Google
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/auth/LoginPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/auth/LoginPage.tsx web/src/auth/LoginPage.test.tsx web/src/App.tsx
git commit -m "feat: add login/signup page with email and Google auth"
```

---

### Task 8: Create Request Form (Requester)

**Files:**
- Create: `web/src/requests/CreateRequestForm.tsx`
- Create: `web/src/requests/CreateRequestForm.test.tsx`

**Interfaces:**
- Consumes: Firebase `functions` client from `web/src/firebase.ts` (Task 6), calls callable `createRequest` (Task 4) via `httpsCallable`.
- Produces: `<CreateRequestForm onCreated={(requestId: string) => void} />`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/requests/CreateRequestForm.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateRequestForm } from "./CreateRequestForm";

const mockCallable = jest.fn();
jest.mock("firebase/functions", () => ({
  httpsCallable: () => mockCallable,
}));
jest.mock("../firebase", () => ({ functions: {} }));

beforeEach(() => mockCallable.mockReset());

test("submits form data to createRequest callable", async () => {
  mockCallable.mockResolvedValue({ data: { requestId: "req-123" } });
  const onCreated = jest.fn();
  render(<CreateRequestForm onCreated={onCreated} />);

  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New laptop" } });
  fireEvent.change(screen.getByLabelText(/category/i), { target: { value: "hardware" } });
  fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Broken" } });
  fireEvent.change(screen.getByLabelText(/urgency/i), { target: { value: "high" } });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));

  await waitFor(() => expect(onCreated).toHaveBeenCalledWith("req-123"));
  expect(mockCallable).toHaveBeenCalledWith({
    title: "New laptop",
    category: "hardware",
    description: "Broken",
    urgency: "high",
  });
});

test("keeps form values and shows error when callable rejects", async () => {
  mockCallable.mockRejectedValue(new Error("Title is required."));
  render(<CreateRequestForm onCreated={jest.fn()} />);

  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "New laptop" } });
  fireEvent.click(screen.getByRole("button", { name: /submit/i }));

  await screen.findByText(/title is required/i);
  expect((screen.getByLabelText(/title/i) as HTMLInputElement).value).toBe("New laptop");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/requests/CreateRequestForm.test.tsx`
Expected: FAIL — `Cannot find module './CreateRequestForm'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/requests/CreateRequestForm.tsx
import { FormEvent, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const CATEGORIES = ["hardware", "software", "access", "other"];
const URGENCIES = ["low", "medium", "high"];

export function CreateRequestForm({
  onCreated,
}: {
  onCreated: (requestId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
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
          <option key={c} value={c}>
            {c}
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/requests/CreateRequestForm.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/src/requests/CreateRequestForm.tsx web/src/requests/CreateRequestForm.test.tsx
git commit -m "feat: add create request form calling createRequest callable"
```

---

### Task 9: Requester Dashboard (own requests, realtime)

**Files:**
- Create: `web/src/requests/RequesterDashboard.tsx`
- Create: `web/src/requests/RequesterDashboard.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 6) for `user.uid`, Firestore `onSnapshot` query on `requests` where `requesterId == uid`, `<CreateRequestForm>` (Task 8).
- Produces: `<RequesterDashboard />`, no props.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/requests/RequesterDashboard.test.tsx
import { render, screen } from "@testing-library/react";
import { RequesterDashboard } from "./RequesterDashboard";
import { useAuth } from "../auth/AuthContext";

jest.mock("../auth/AuthContext");
jest.mock("../firebase", () => ({ db: {}, functions: {} }));

let snapshotCallback: (snap: any) => void;
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: (_q: any, cb: any) => {
    snapshotCallback = cb;
    return () => {};
  },
}));

test("renders own requests from Firestore snapshot", () => {
  (useAuth as jest.Mock).mockReturnValue({ user: { uid: "requester-1" } });
  render(<RequesterDashboard />);

  snapshotCallback({
    docs: [
      {
        id: "req-1",
        data: () => ({ title: "New laptop", status: "pending", urgency: "high" }),
      },
    ],
  });

  expect(screen.getByText("New laptop")).toBeInTheDocument();
  expect(screen.getByText("pending")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/requests/RequesterDashboard.test.tsx`
Expected: FAIL — `Cannot find module './RequesterDashboard'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/requests/RequesterDashboard.tsx
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
        snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Omit<RequestRow, "id">) }))
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/requests/RequesterDashboard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/requests/RequesterDashboard.tsx web/src/requests/RequesterDashboard.test.tsx
git commit -m "feat: add requester dashboard with realtime own-request list"
```

---

### Task 10: IT/Admin Dashboard (all requests + review actions)

**Files:**
- Create: `web/src/requests/ItAdminDashboard.tsx`
- Create: `web/src/requests/ItAdminDashboard.test.tsx`

**Interfaces:**
- Consumes: Firestore `onSnapshot` on full `requests` collection, `httpsCallable(functions, "reviewRequest")` (Task 5).
- Produces: `<ItAdminDashboard />`, no props.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/requests/ItAdminDashboard.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ItAdminDashboard } from "./ItAdminDashboard";

const mockCallable = jest.fn();
jest.mock("firebase/functions", () => ({ httpsCallable: () => mockCallable }));
jest.mock("../firebase", () => ({ db: {}, functions: {} }));

let snapshotCallback: (snap: any) => void;
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  onSnapshot: (_ref: any, cb: any) => {
    snapshotCallback = cb;
    return () => {};
  },
}));

beforeEach(() => mockCallable.mockReset());

test("renders all requests and approves on click", async () => {
  mockCallable.mockResolvedValue({ data: { status: "approved" } });
  render(<ItAdminDashboard />);

  snapshotCallback({
    docs: [
      {
        id: "req-1",
        data: () => ({ title: "New laptop", status: "pending", requesterId: "r1" }),
      },
    ],
  });

  fireEvent.click(await screen.findByRole("button", { name: /approve/i }));

  await waitFor(() =>
    expect(mockCallable).toHaveBeenCalledWith({ requestId: "req-1", decision: "approve" })
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/requests/ItAdminDashboard.test.tsx`
Expected: FAIL — `Cannot find module './ItAdminDashboard'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/requests/ItAdminDashboard.tsx
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
        snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as Omit<RequestRow, "id">) }))
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/requests/ItAdminDashboard.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add web/src/requests/ItAdminDashboard.tsx web/src/requests/ItAdminDashboard.test.tsx
git commit -m "feat: add IT/Admin dashboard with approve/reject/revision actions"
```

---

### Task 11: Role-Based Routing (App shell)

**Files:**
- Modify: `web/src/App.tsx`
- Create: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Task 6) for `user`/`role`/`loading`, `<LoginPage>` (Task 7), `<RequesterDashboard>` (Task 9), `<ItAdminDashboard>` (Task 10).
- Produces: top-level `<App />` — the only component mounted by `main.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// web/src/App.test.tsx
import { render, screen } from "@testing-library/react";
import App from "./App";
import { useAuth } from "./auth/AuthContext";

jest.mock("./auth/AuthContext");
jest.mock("./auth/LoginPage", () => ({ LoginPage: () => <div>login-page</div> }));
jest.mock("./requests/RequesterDashboard", () => ({
  RequesterDashboard: () => <div>requester-dashboard</div>,
}));
jest.mock("./requests/ItAdminDashboard", () => ({
  ItAdminDashboard: () => <div>it-admin-dashboard</div>,
}));

test("shows login page when signed out", () => {
  (useAuth as jest.Mock).mockReturnValue({ user: null, role: null, loading: false });
  render(<App />);
  expect(screen.getByText("login-page")).toBeInTheDocument();
});

test("shows requester dashboard for requester role", () => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { uid: "u1" },
    role: "requester",
    loading: false,
  });
  render(<App />);
  expect(screen.getByText("requester-dashboard")).toBeInTheDocument();
});

test("shows it_admin dashboard for it_admin role", () => {
  (useAuth as jest.Mock).mockReturnValue({
    user: { uid: "u2" },
    role: "it_admin",
    loading: false,
  });
  render(<App />);
  expect(screen.getByText("it-admin-dashboard")).toBeInTheDocument();
});

test("shows loading state while auth resolves", () => {
  (useAuth as jest.Mock).mockReturnValue({ user: null, role: null, loading: true });
  render(<App />);
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/App.test.tsx`
Expected: FAIL — current `App.tsx` is the Vite default template, none of the expected text renders.

- [ ] **Step 3: Write minimal implementation**

```tsx
// web/src/App.tsx
import { useAuth } from "./auth/AuthContext";
import { LoginPage } from "./auth/LoginPage";
import { RequesterDashboard } from "./requests/RequesterDashboard";
import { ItAdminDashboard } from "./requests/ItAdminDashboard";

export default function App() {
  const { user, role, loading } = useAuth();

  if (loading) return <p className="mt-16 text-center">Loading...</p>;
  if (!user) return <LoginPage />;
  if (role === "it_admin") return <ItAdminDashboard />;
  return <RequesterDashboard />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/App.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run full test suites and build**

Run: `cd web && npx jest && npm run build && cd ..`
Expected: all `web/` tests pass, build succeeds.

Run: `firebase emulators:exec --only firestore "npm test"` (from `functions/`)
Expected: all `functions/` tests pass.

Run: `npm run test:rules` (from root)
Expected: all rules tests pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.tsx web/src/App.test.tsx
git commit -m "feat: wire role-based routing in App shell"
```

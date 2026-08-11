# ReqFlow — Core Sub-Project Design

> Sub-project 1 of 3 (Core → AI+Notion pipeline → Discord notify).
> Covers: auth, request creation, IT review, Firestore schema.

## Scope

Foundation of ReqFlow: users log in, create requests, IT/Admin reviews them
(approve/reject/request revision). Does NOT cover AI processing, Notion sync,
or Discord notifications — those are separate sub-projects that build on
this one's data model.

## 1. Architecture

- **Frontend**: React + Vite + Tailwind (SPA). No SSR needed — internal tool,
  no SEO requirement.
- **Auth**: Firebase Auth — email/password + Google Sign-In.
- **Database**: Firestore.
- **Backend logic**: Firebase Cloud Functions v2 (TypeScript) — callable
  functions for validated writes (create request, review action), Firestore
  triggers for side effects (future: Discord notify, AI pipeline handoff).
- **Hosting**: Firebase Hosting.
- Fully serverless — no dedicated backend server to maintain.

## 2. Data Model (Firestore)

```
users/{uid}
  - email: string
  - displayName: string
  - role: "requester" | "it_admin"
  - createdAt: timestamp

requests/{requestId}
  - requesterId: string (uid)
  - title: string
  - category: "feature_request" | "bug_fix" | "maintenance" | "other"
  - description: string
  - urgency: "low" | "medium" | "high"
  - status: "pending" | "revision_requested" | "rejected" | "approved" | <notion-synced string>
  - reviewedBy: string (uid) | null
  - reviewNote: string | null
  - notionPageId: string | null   // filled by sub-project 2 after approval
  - createdAt: timestamp
  - updatedAt: timestamp
```

Once a request reaches `approved`, its `status` field becomes a free-form
string synced from Notion by sub-project 2 (AI+Notion pipeline) — Core does
not define that enum, only reserves the field and the `notionPageId` link.

### Security Rules

- `requester`: can create requests for themselves; can read/update only
  their own request docs, and only while `status == "revision_requested"`.
- `it_admin`: can read/update all request docs; can set `status` to
  `approved` / `rejected` / `revision_requested` with an optional
  `reviewNote`.
- Role stored on the `users/{uid}` doc; `it_admin` role is assigned
  manually (no self-signup as admin).

## 3. Request Lifecycle & Roles

- **Requester**:
  1. Creates request → `status: pending`.
  2. If IT sets `revision_requested`, edits and resubmits → back to
     `pending`.
  3. Views own requests' status in real time via Firestore listener.
- **IT/Admin**:
  1. Views all requests (dashboard, all statuses).
  2. Takes one action per request: `approve`, `reject`, or
     `request_revision` (with optional note), via a callable Cloud
     Function that validates the actor's role server-side.
  3. `approve` sets `status: approved` — this is the handoff point to
     sub-project 2 (AI processing + Notion push), out of scope here.
- Roles: exactly two — `requester` (default on signup) and `it_admin`
  (assigned manually by an existing admin, not self-service).

## 4. Error Handling

- Firestore security rules are the enforcement boundary (ownership/role),
  not just UI-level checks.
- Callable Cloud Functions validate input server-side (required
  title/description, enum check on `category`/`urgency`) before write,
  returning typed errors (`invalid-argument`, `permission-denied`).
- Frontend: on write failure, show a toast error and preserve form input
  (no silent reset/loss of user input).
- Auth errors (bad credentials, network) surfaced via mapped, readable
  messages per Firebase Auth error code.

## 5. Testing

- Cloud Functions: unit tests against the Firebase Emulator Suite
  (Firestore + Functions), Jest.
- Security rules: `@firebase/rules-unit-testing` — verify ownership and
  role enforcement (requester can't read others' requests, can't
  self-approve, etc.).
- Frontend: React Testing Library — form validation, role-based
  conditional rendering (requester view vs. it_admin view).

## Out of Scope (future sub-projects)

- AI processing of approved requests.
- Notion API push and status sync-back.
- Discord webhook notifications on request create/status change.

# ReqFlow — Migrate Backend from Firebase to PocketBase

> Supersedes the Firebase-specific parts of `2026-08-11-core-design.md`.
> Trigger: Firebase Cloud Functions v2 require the Blaze (paid) plan —
> discovered only when attempting to deploy. This spec swaps the backend
> to PocketBase, a self-hosted single-binary alternative with no billing
> tier requirement, while keeping the Core sub-project's behavior and UI
> unchanged.

## Scope

Backend swap only: auth, request lifecycle (create/review/revise),
authorization rules, and hosting. The frontend's visual design (Tailwind
ticket-stub theme, page structure) is unaffected — only the data-layer
calls (Firebase SDK → PocketBase SDK) change.

## 1. Architecture

- Frontend: unchanged — React + Vite + Tailwind SPA.
- Backend: **PocketBase**, a single Go binary bundling SQLite, an auth
  system, a REST+realtime API, and a per-collection API Rules engine
  (string expressions evaluated per request — the equivalent of Firestore
  Security Rules).
- No custom server code (no Cloud-Functions-equivalent) — every
  validation and authorization requirement from the Firebase design is
  expressed as collection schema constraints (required fields, select
  enums) and API Rules.
- Hosting: PocketBase binary on the user's existing Ubuntu/Debian VPS,
  run under systemd, bound to `127.0.0.1:8090`. Caddy reverse-proxies the
  user's domain to that port and handles automatic HTTPS (Let's Encrypt).
  Only ports 80/443 are open to the public internet.

## 2. Data Model (PocketBase Collections)

### `users` (built-in auth collection)

Extends PocketBase's default auth collection fields (`email`, `password`,
`name`) with:

- `role` — select, options `requester` | `it_admin`, default `requester`.

### `requests` (base collection)

- `requester` — relation → `users` (single), required.
- `title` — text, required.
- `category` — select, options `feature_request` | `bug_fix` |
  `maintenance` | `other`, required.
- `description` — text, required.
- `urgency` — select, options `low` | `medium` | `high`, required.
- `status` — **text** (not select) — kept as free text so a future
  sub-project can write arbitrary Notion-synced status strings via an
  admin/service auth token (which bypasses API Rules entirely). Rule
  enforcement below constrains the values a non-admin client can write.
- `reviewedBy` — relation → `users` (single), nullable.
- `reviewNote` — text, nullable.
- `notionPageId` — text, nullable (reserved for a future sub-project).

Built-in `id`, `created`, `updated` fields apply to both collections.

## 3. API Rules (authorization + validation)

Rules are boolean filter expressions PocketBase evaluates against the
request and, for update/delete, the existing record. They are this
project's equivalent of Firestore Security Rules.

### `users`

- `listRule` / `viewRule`: `id = @request.auth.id || @request.auth.role = "it_admin"`
- `createRule`: public (registration is open) — role is not attacker-settable
  because the create rule additionally requires
  `@request.data.role:isset = false` (the field must be absent from the
  signup payload, so it always falls back to the schema default
  `requester`).
- `updateRule`: `(id = @request.auth.id && @request.data.role:isset = false) || @request.auth.role = "it_admin"`
  — a user may update their own profile fields but not their own `role`;
  only an `it_admin` may change any user's `role`. This is done from the
  PocketBase Admin UI (an improvement over the Firebase design, which
  required a manual REST/console edit).
- `deleteRule`: `@request.auth.role = "it_admin"`

### `requests`

- `listRule` / `viewRule`: `requester = @request.auth.id || @request.auth.role = "it_admin"`
- `createRule`: `@request.data.requester = @request.auth.id && @request.data.status = "pending"`
- `updateRule`:
  `@request.auth.role = "it_admin" || (requester = @request.auth.id && status = "revision_requested" && @request.data.status = "pending" && @request.data.requester = requester)`
  — mirrors the Firebase design's rule exactly: IT/Admin can update
  anything; the owner can only edit while `revision_requested`, and only
  to flip status back to `pending` without reassigning the request.
- `deleteRule`: `""` (nobody — equivalent to Firestore's `allow delete: if false`)
- **Note-required enforcement** (new — was frontend-only under Firebase):
  the `it_admin` branch of `updateRule` additionally requires, when the
  incoming status is `rejected` or `revision_requested`, that
  `@request.data.reviewNote != ""`. This moves an existing frontend-only
  constraint into a backend-enforced one.

## 4. Auth Setup

- **Email/password**: PocketBase's native auth collection endpoints
  (`authWithPassword`, `create` for registration). Email verification is
  left disabled for now (internal tool; can be enabled later without a
  schema change).
- **Google**: register an OAuth2 client in Google Cloud Console, add the
  Client ID/Secret in PocketBase Admin UI → Settings → Auth Providers →
  Google, with redirect URL `https://<domain>/api/oauth2-redirect`. The
  frontend calls `pb.collection('users').authWithOAuth2({ provider: 'google' })`
  — PocketBase's JS SDK handles the popup and redirect.
- `pb.authStore` persists the session (localStorage) and exposes the
  authenticated user's record — including `role` — directly, with no
  extra round-trip. This removes the Firebase design's `bootstrapUser`
  callable entirely: there is no longer a separate "fetch my role after
  login" step.

## 5. Deployment (VPS)

- Download the PocketBase binary to the VPS (e.g. `/opt/pocketbase/`).
  Data lives in `/opt/pocketbase/pb_data/` (SQLite file — durable on
  disk, unlike the Firebase emulator's in-memory-by-default state).
- Run it under a systemd unit (`pocketbase.service`) bound to
  `127.0.0.1:8090`, `Restart=on-failure`, enabled on boot.
- Caddy reverse-proxies the user's domain to `127.0.0.1:8090` and
  provisions HTTPS automatically. No other inbound ports are exposed.

## 6. Migration from the Existing Firebase Code

**Removed entirely:**
- `functions/` (all three callables — logic now lives in schema + rules)
- `firestore.rules`, `firestore.indexes.json`, `.firebaserc`
- the `functions` and `firestore` sections of `firebase.json`
- `firebase-admin` / `firebase-functions` dependencies

**Replaced:**
- `web/src/firebase.ts` → `web/src/pocketbase.ts` (`new PocketBase(url)`,
  using the `pocketbase` npm package)
- `AuthContext.tsx`: `onAuthStateChanged` + `bootstrapUser` callable →
  `pb.authStore.onChange` + `pb.authStore.model` (role included, no
  extra call)
- `CreateRequestForm.tsx` / `ReviseRequestForm.tsx`: `httpsCallable(...)`
  / direct Firestore `updateDoc` → `pb.collection('requests').create()` /
  `.update()`
- `RequesterDashboard.tsx` / `ItAdminDashboard.tsx`: Firestore
  `onSnapshot` → `pb.collection('requests').subscribe('*', cb)` +
  `getFullList()` for the initial load
- `ItAdminDashboard.tsx`'s `review()`: `httpsCallable("reviewRequest")` →
  `pb.collection('requests').update(id, { status, reviewedBy, reviewNote })`
- Env vars: six `VITE_FIREBASE_*` vars → one `VITE_POCKETBASE_URL`

**Unchanged:** all Tailwind/design-system code (`TicketCard`,
`StatusStamp`, `index.css`, `tailwind.config.js`) and the overall page
structure — this is a backend swap only.

## 7. Testing / Verification

No custom backend code exists to unit test — the backend is schema and
declarative rules, which is a small enough surface that manual
verification (the same flows already exercised against the Firebase
emulator: signup, create request, approve/reject/request-revision,
requester edit-and-resubmit) is sufficient. Verify locally against a
PocketBase instance run on this machine before deploying to the VPS.

## Out of Scope

- Data migration from the Firebase emulator's test data (it was test
  data only; the PocketBase instance starts fresh).
- The AI + Notion pipeline and Discord notification sub-projects — both
  remain unaffected by this backend swap and are addressed separately.

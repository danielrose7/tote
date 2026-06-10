# Neon Collections Implementation Handoff

Last updated: June 10, 2026

This is the execution companion to
[`NEON_COLLECTIONS_ARCHITECTURE.md`](./NEON_COLLECTIONS_ARCHITECTURE.md).
Read that document for the data model and design rationale. Use this document
to resume implementation without reconstructing project state from chat history.

## Objective

Move private collections from classic Jazz to Neon Postgres while preserving:

- Offline-capable web, extension, and iOS experiences.
- Server-readable data for support, administration, and future paid features.
- Collection collaboration with owner, admin, editor, and viewer roles.
- Independent public snapshots so private collections can change after publish.
- A recoverable, web-only migration path for existing Jazz accounts.

Neon is the authoritative store. Local stores are caches and durable mutation
queues, not independently writable authorities. Do not introduce Neon/Jazz
dual-write or use Jazz v2 as a second writable cache.

## Decisions Already Made

- Use Drizzle for schema, migrations, repositories, and ordinary writes.
- Use Neon Postgres as the canonical private collection database.
- Use TanStack Query with account-scoped IndexedDB persistence on web.
- Use Ably LiveSync as realtime invalidation over Vercel-compatible HTTPS writes.
- Use a small `chrome.storage.local` cache and outbox in the extension initially.
- Use SQLite for the eventual iOS local cache and durable outbox.
- Keep classic Jazz read-only during migration and the 14-day rollback window.
- Run legacy migration only in the web app. The internal iOS data may be reset.
- Publishing copies/upserts private data into independent public snapshot rows.
- "Make a copy" duplicates rows and retains lineage; it does not share ownership.
- Collections have denormalized `item_count`.
- Nodes support product, link, photo, note, section, and future non-product types.
- Application authorization is required now. Postgres RLS remains a later hardening
  step.

## Completed Work

The database foundation, collection repositories and APIs, web collection UI,
offline persistence, publication, sharing/team management, Jazz migration,
realtime invalidation, rollout gating, migration health tooling, and the
extension capture migration (checkpoints 1–4 below) are implemented and
committed.

Important recent commits:

```text
c96e618 Add collection creation to extension capture
9530f58 Add extension capture cache and durable outbox
9ba5763 Add online Neon capture path to extension
7c28d5e Add Neon capture API
0356613 Gate collection migration rollout
5bf3086 Add collection migration health dashboard
1f9cf40 Add collection realtime invalidation
7d003c4 Reject incomplete Classic Jazz exports
d0e01df Copy unmigrated shared Jazz collections
30dab3d Show shared collections awaiting migration
953af29 Migrate Classic Jazz collection members
8159d96 Persist collection migration failures
```

The capture API in `7c28d5e` provides:

- `GET /api/v2/capture`: writable owner/admin/editor collections and sections.
- `POST /api/v2/capture`: authenticated, idempotent product capture.
- Validation that a selected section belongs to the target collection.
- Transactional `item_count` maintenance through the collection repository.

## Current Workspace State

Extension checkpoints 1–4 are committed; the working tree should be clean.
Inspect `git status` before editing.

The implemented extension behavior is:

- Accounts with Clerk public metadata `neonCollectionsEnabled: true` use the
  Neon capture API; `404`/`409` falls back to classic Jazz during rollout.
- The picker lists writable collections and sections, remembers the last
  selected collection per account, and can create a new collection online
  (the server assigns its end-of-list `positionKey`).
- Captures persist to an account-scoped `chrome.storage.local` outbox before
  any network attempt, reuse stable node/mutation UUIDs on retry, flush on
  popup startup and connectivity recovery, and purge on sign-out or account
  change. Rejected entries stay visible with retry/remove actions.
- Jazz mounts only on the classic fallback path (`JazzProvider` inside
  `AuthenticatedSaveUI`); Neon-enabled accounts never open a Jazz connection.
- Manual popup verification against a real allowlisted account remains
  deferred per the browser-policy caveat below; automated coverage lives in
  `neonCapture.test.ts`, `captureStore.test.ts`, and `NeonSaveUI.test.tsx`.

## Next Checkpoints

Commit after each checkpoint. Checkpoints 1–4 are complete; their
descriptions are retained below as the record of what was delivered. The
next checkpoint is 5 (iOS Neon vertical slice).

### 1. (Done) Finish Online Extension Capture

- Review only the in-progress extension files and preserve unrelated changes.
- Run the focused Neon client test and extension production build.
- Check the popup against a real authenticated, allowlisted account when browser
  policy and a reachable app environment permit it.
- Confirm owner/admin/editor collections appear and viewer collections do not.
- Confirm a section save increments `item_count` exactly once on retry.
- Commit as a standalone extension checkpoint.

Exit: an allowlisted signed-in extension user can save an extracted product to a
Neon collection or section online, while non-allowlisted users still use Jazz.

### 2. (Done) Add Extension Cache And Durable Outbox

Use account-scoped records in `chrome.storage.local`.

Suggested records:

```ts
type CachedCaptureIndex = {
  version: 1;
  userId: string;
  fetchedAt: string;
  collections: NeonCaptureCollection[];
};

type CaptureOutboxEntry = {
  version: 1;
  userId: string;
  nodeId: string;
  mutationId: string;
  collectionId: string;
  sectionId: string | null;
  payload: CapturePayload;
  status: 'pending' | 'sending' | 'failed';
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
  lastError: string | null;
};
```

Requirements:

- Cache the writable collection index after every successful API read.
- Show a cached index while offline, with a visible stale/offline state.
- Persist an outbox entry before attempting the network request.
- Reuse stable `nodeId` and `mutationId` on every retry.
- Flush on popup startup and browser connectivity recovery where practical.
- Delete an entry only after a successful or idempotently replayed response.
- Keep rejected entries visible and retryable instead of silently dropping them.
- Scope all cache keys by Clerk user ID and purge on sign-out/account change.
- Purge collection data promptly after membership revocation is observed.
- Cover serialization, account isolation, retries, replay, and purge with tests.

Exit: a capture made offline survives popup/browser restart and is inserted once
after reconnect.

### 3. (Done) Extension Collection And Section Creation

- Add capture-specific create endpoints or reuse the authorized v2 collection
  APIs if their payloads are suitable.
- Let the server assign canonical ordering.
- Update the cached index after creation.
- Queue creation dependencies only if offline creation is included in this
  phase; otherwise clearly disable it while offline.

Exit: the extension can create a destination and immediately save into it
without Jazz.

Delivered as collection creation only (online, via `POST
/api/v2/collections` with a now-optional `positionKey`). Section creation
from the extension was deferred; sections are still created on the web and
appear in the picker on the next index read.

### 4. (Done) Extension Verification And Jazz Untangling

- Exercise sign-in, allowlist switching, empty state, collection selection,
  section selection, online save, offline queue, retry, and sign-out purge.
- Test revoked membership and expired Clerk sessions.
- Keep the Jazz provider only for migration/rollout fallback.
- Do not remove the legacy extension path until the migration window closes.

Exit: Neon-enabled accounts no longer depend on Jazz for normal extension use.

### 5. iOS Neon Vertical Slice

- Replace the iOS Jazz collection path with a SQLite-backed local repository.
- Model account-scoped query data, mutation outbox, sync metadata, and tombstones.
- Port collection list/detail and product/link/photo/note editing incrementally.
- Send writes through the same authenticated Neon-backed application APIs.
- Port share-sheet capture with durable offline queuing.
- Store auth secrets in platform secure storage; purge local data on sign-out or
  membership revocation.
- Reset the sole internal Jazz test account instead of shipping mobile migration.

Exit: collection edits and share-sheet captures survive process termination,
sync exactly once after reconnect, and appear on web through realtime invalidation.

### Deferred: Clerk User Projection

This is useful for collaboration UX and account lifecycle management, but it is
not required before beginning the iOS vertical slice.

- Keep Clerk authoritative for identity, authentication, and session validity.
- Add a minimal Neon user projection keyed by Clerk user ID for fields Tote
  needs to query or display, such as display name, primary email, username,
  avatar URL, and deleted status.
- Listen for verified, idempotent `user.created`, `user.updated`, and
  `user.deleted` Clerk webhooks.
- Upsert the current user opportunistically during authenticated app use so
  onboarding never depends on eventually consistent webhook delivery.
- Use the local projection to render collaborators and audit actors instead of
  exposing raw Clerk IDs.
- Define deletion, anonymization, collection ownership transfer, billing
  retention, and audit-history behavior before acting on `user.deleted`.
- Update the existing account-deletion route to cover the Neon collection model
  before relying on it for production account removal.

## Configuration And External Setup

- Root rollout requires `NEON_COLLECTIONS_API_ENABLED=true`.
- Existing-account rollout additionally requires Clerk public metadata
  `neonCollectionsEnabled: true`.
- Realtime requires `ABLY_API_KEY` on the server.
- The Ably Postgres connector must be deployed/configured outside this repo.
- Never expose the Ably API key through `NEXT_PUBLIC_*`.
- The extension API origin uses `VITE_APP_URL` when present and otherwise derives
  localhost from `VITE_SYNC_HOST` or falls back to `https://tote.tools`.

## Verification Commands

Root:

```bash
pnpm test -- --run
pnpm test:db
pnpm exec tsc --noEmit
pnpm exec biome check <changed-files>
```

Extension:

```bash
pnpm --dir chrome-extension exec vitest run src/lib/neonCapture.test.ts
pnpm --dir chrome-extension build
pnpm --dir chrome-extension exec biome check <changed-files>
```

Known caveats as of this handoff:

- The full extension Vitest suite can hang in repeated jsdom
  `Could not parse CSS stylesheet` output after extractor tests complete.
- Standalone extension `tsc --noEmit` reports pre-existing Jazz, Node type, and
  extractor typing errors. The production Vite build is currently the useful
  compile gate.
- The popup bundle remains large while classic Jazz is still bundled.
- Saved browser policy blocks localhost access in the in-app browser. Do not
  bypass that policy; use an allowed reachable environment or defer manual UI
  verification.

## Release Acceptance

Do not call the platform migration complete until:

- Web, extension, and iOS all use Neon for normal collection reads and writes.
- Offline mutations survive restart and reconcile idempotently on every client.
- Role changes and revocations update access and purge unauthorized local data.
- Public snapshots remain stable until an explicit republish.
- Existing Jazz users can migrate, verify, retry, confirm cutover, and roll back
  during the support window.
- Operational dashboards expose failed migrations, rejected mutations, and
  realtime delivery failures.
- Marketing and privacy language accurately describes server-readable private
  data and any optional E2EE surfaces.

## Guardrails

- Do not clear remote Jazz data during the initial migration program.
- Do not infer migration completion from the presence of Neon rows.
- Do not maintain indefinite Jazz/Neon dual-write.
- Do not make the extension or iOS cache a second source of truth.
- Do not broaden a checkpoint into unrelated refactors.
- Do not remove classic Jazz migration/export code before the rollback window
  and support obligations have ended.

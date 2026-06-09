# Neon Collections Architecture

Status: implementation in progress

## Executive Summary

Move private collection data to Neon as the canonical source of truth, with a
durable device-side cache for responsive reads, optimistic writes, and offline
use.

The recommended shape is:

```text
Web
  -> React Server Components for authoritative initial reads
  -> TanStack Query for client cache, mutations, and invalidation
  -> IndexedDB persistence for cached queries and paused mutations
  -> HTTPS mutation API
  -> Neon Postgres + transactional Ably outbox

Mobile
  -> SQLite cache and durable mutation queue
  -> HTTPS mutation API
  -> Neon Postgres + transactional Ably outbox
```

The first implementation will use TanStack Query plus IndexedDB on the web and
Ably LiveSync for realtime invalidations. This keeps Neon authoritative, fits the
existing Next.js application, and lets Tote introduce offline behavior
incrementally without adopting a second frontend state model. PowerSync remains
a credible later option if maintaining custom mobile replication, durable
queues, and revocation cleanup becomes more expensive than a managed sync
layer.

Jazz v2 should be evaluated as an alternative canonical database, not as a cache
in front of Neon. Jazz v2 has its own server, storage model, permissions, history,
and conflict semantics. Using Neon and Jazz v2 as writable authorities would
require Tote to build and operate a custom bidirectional bridge, including loop
prevention, conflict handling, migration coordination, and failure recovery.

The major product decision is privacy:

- Plaintext application data in Neon gives Tote conventional private-by-access-
  control semantics and enables support, search, automation, and AI.
- End-to-end encrypted fields can be stored in Neon, but server-side features
  cannot use those fields unless the user explicitly grants a worker access to
  their keys.
- Moving from classic Jazz E2EE to server-readable Neon changes the privacy
  promise and requires updated product copy and policy disclosures.

## Current Responsibilities Supplied by Jazz

Classic Jazz currently provides more than storage:

1. Account-rooted collection discovery.
2. Durable local persistence and offline writes.
3. Real-time synchronization between devices.
4. Reactive subscriptions in web, mobile, and extension UIs.
5. Nested collection, slot, and product ordering.
6. Group ownership and reader/writer/admin permissions.
7. Invite creation and acceptance.
8. Concurrent mutation handling.
9. Public CoValue clones.
10. Client-generated identifiers.

Moving collections to Neon means replacing each responsibility deliberately.

Neon already stores:

- Curator sessions, answers, briefs, and results.
- AI usage and billing records.
- Published collection snapshots.
- Public collection blocks.

## Lessons From Notion's Data Model

Notion's 2021 architecture article does not publish literal DDL, indexes,
partitioning, or current infrastructure details. However, the diagrams and text
do expose enough to infer the general persisted shape. It is intentionally a
small, block-based record model.

### The Notion block record

Notion represents nearly every user-facing object as a block with:

- A client-generated UUID.
- A type.
- A flexible properties payload.
- An ordered list of child block IDs called `content`.
- A parent block ID used for permission ancestry.

An approximate relational representation is:

```sql
CREATE TABLE blocks (
  id         UUID PRIMARY KEY,
  type       TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  content    UUID[] NOT NULL DEFAULT '{}',
  parent_id  UUID,
  version    BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  deleted_at TIMESTAMPTZ
);
```

The article does not establish that this is Notion's literal DDL, but it captures
the schema visible in its diagrams:

```text
id
type
properties
content: ordered child IDs
parent: permission parent
```

The downward `content` pointers define the render tree. The upward `parent`
pointer gives permission checks one unambiguous route to the workspace root.
Notion historically allowed a block to appear in multiple content arrays, which
is why render containment alone could not safely determine permissions.

### The Notion client and sync loop

Notion describes this flow:

```text
UI action
  -> client generates one or more record operations
  -> operations are grouped into an atomic transaction
  -> transaction is applied to local state immediately
  -> records persist in SQLite or IndexedDB RecordCache
  -> transaction persists in SQLite or IndexedDB TransactionQueue
  -> /saveTransactions validates before/after state and commits or rejects
  -> MessageStore sends changed record versions over WebSocket
  -> other clients fetch records whose local versions are stale
```

Important characteristics:

- The server database remains authoritative.
- The local cache and transaction queue survive process restarts.
- A user action can change several rows atomically.
- Realtime messages are invalidations/version notifications, not necessarily the
  complete changed payload.
- Clients subscribe only to records they render.
- Server validation has both the before and after state of a transaction.
- Search indexing and version-history work happen asynchronously after commit.

### What Tote should adopt

#### Client-generated IDs

This is already part of the proposed model and is essential for offline creates.

#### Durable local record cache and transaction queue

Treat these as separate responsibilities even if a sync SDK implements both:

- The record cache answers local queries.
- The transaction queue preserves unsynced user intent.

A cache may be evicted. Pending transactions must not be evicted.

#### Atomic user transactions

A product move, for example, can include:

- Updating `section_id`.
- Updating `position_key`.
- Repairing an invalid selection state.

Those changes should be accepted or rejected together. The mutation API and local
outbox should support a transaction containing multiple row operations rather
than treating every field write as an unrelated request.

Add an optional transaction envelope:

```text
client_transactions
  id                 UUID primary key
  user_id            text
  device_id          UUID
  client_sequence    bigint
  status             pending | accepted | rejected
  accepted_at        timestamptz
  rejection_code     text
  created_at         timestamptz
```

The transaction's row operations can arrive as a validated API payload. They do
not need to remain indefinitely in Postgres after the idempotency and diagnostic
retention window.

#### Explicit record versions

Add a monotonic `version` to syncable records, assigned when the server accepts a
change. `updated_at` is useful for people and retention; it is a weak sync token.

Versions support:

- Stale-record detection.
- Conditional writes.
- Realtime invalidation messages.
- More useful conflict diagnostics.
- Efficient "send me these records if my versions differ" APIs.

If a managed sync layer provides its own authoritative versioning, Tote may not
need to expose this in the first client API, but keeping version semantics in the
domain model is still valuable.

#### Narrow subscriptions

Clients do not need every row at equal priority:

- Collection index rows should be available quickly.
- Full item data can follow for recently opened collections.
- Public pages should use server reads, not private-client replication.
- The extension needs a writable collection/section index and a save outbox, not
  every product row.

This is both a cost and cold-start optimization.

#### Asynchronous derived work

Price refresh, search indexing, previews, AI context preparation, publication
snapshots, and history should consume accepted database changes asynchronously.
They should not be required for the primary collection transaction to succeed.

### A block model is a credible Tote option

Tote is already block-based in classic Jazz:

```text
collection block
  slot blocks
    product blocks
  top-level product blocks
  collection note blocks
```

Retaining that shape in Neon could substantially reduce conceptual and migration
distance across the web, mobile app, and extension.

An initial Tote block schema could be:

```sql
CREATE TYPE block_type AS ENUM (
  'collection',
  'section',
  'product',
  'collection_note'
);

CREATE TABLE blocks (
  id                 UUID PRIMARY KEY,
  collection_id      UUID NOT NULL,
  parent_id          UUID,
  type               block_type NOT NULL,
  properties         JSONB NOT NULL DEFAULT '{}',
  position_key       TEXT NOT NULL,
  version            BIGINT NOT NULL DEFAULT 1,
  created_by_user_id TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);
```

The collection block is its own `collection_id` and has no content parent.
Descendants carry the root `collection_id` for authorization and efficient sync.
Their `parent_id` determines render containment:

```text
collection
  parent_id = null
  collection_id = self

section
  parent_id = collection
  collection_id = collection

product in section
  parent_id = section
  collection_id = collection

top-level product
  parent_id = collection
  collection_id = collection
```

`properties` can preserve the current type-specific payloads:

```json
{
  "name": "Lighting",
  "budgetCents": 50000,
  "maxSelections": 2
}
```

or:

```json
{
  "name": "Pendant lamp",
  "url": "https://example.com/lamp",
  "priceMinor": 12900,
  "currency": "USD",
  "isSelected": true
}
```

This is the closest Neon equivalent to the current `Block` CoValue.

### Where Tote may differ from Notion

#### Parent plus position instead of content arrays

Notion's diagram stores an ordered `content` array on the parent as well as an
upward `parent` pointer. Tote can do this literally, but it creates two
representations that must agree.

For Tote, `parent_id + position_key` is probably the simpler canonical render
relationship:

- A move updates the child row.
- Foreign keys can validate the parent.
- Partial replication is straightforward.
- Querying a collection does not require following arrays of IDs.
- Concurrent inserts do not rewrite one shared parent array.

If atomic parent content arrays prove important for sync semantics, they remain a
valid alternative. The tradeoff should be tested, not assumed.

#### Typed columns versus JSONB properties

A pure Notion-like model puts almost everything in `properties`. A fully
normalized model gives every entity its own table. Tote can use a hybrid:

- Keep common graph and sync fields as columns.
- Keep flexible display and extractor fields in JSONB initially.
- Promote fields to columns when they need constraints, indexes, joins, or
  arithmetic.

Likely promoted fields:

- `collection_id`
- `parent_id`
- `type`
- `position_key`
- `version`
- `deleted_at`
- Possibly `normalized_url`, `price_minor`, `currency`, and `is_selected`

This avoids prematurely creating many tables without turning all business rules
into unindexed JSON interpretation.

#### Permissions at the collection root

Notion needs parent ancestry because any page or block can become a sharing
boundary. Tote currently shares collections. `collection_id` can therefore point
directly to the permission root and avoid recursive permission checks.

If Tote later supports sharing an individual section, add a
`permission_root_id` rather than inferring permissions from render order.

#### Ordered arrays of child IDs

Notion's `content` arrays match its record model, but in Postgres they complicate:

- Foreign-key integrity.
- Concurrent inserts and moves.
- Partial row replication.
- Querying all items in a collection.
- Repairing one-sided parent/child pointers.

For Tote, child rows should carry `collection_id`, nullable `section_id`, and a
fractional `position_key`. This gives one canonical containment relation.

#### Permission ancestry on every item

The collection is Tote's natural sharing boundary. Every section, item, and note
already carries `collection_id`, so authorization can check membership directly
without recursively walking a parent tree.

If arbitrary nested sharing is introduced later, a separate permission-root
column can be added. It should not be inferred from presentation order.

### Resulting Tote record shape

The closest Notion-inspired model for Tote is:

```text
Permission root:
  root collection block + collection_members

Render structure:
  blocks(collection_id, parent_id, type, position_key, properties)

Local state:
  SQLite/IndexedDB mirror of authorized records
  durable client transaction queue

Server commit:
  authenticated, idempotent, atomic transaction validation

Realtime:
  replicated row changes or lightweight record-version invalidations
```

This preserves Tote's current block vocabulary while making Neon the source of
truth and keeping permissions simpler than Notion's arbitrary nested sharing.

## Target System Boundaries

### Canonical data

Neon is authoritative for:

- Collections and their contents.
- Collection membership and roles.
- Invites.
- Notes, selections, budgets, and ordering.
- Publication configuration and snapshots.
- Default collection preference.
- Curator provenance links.

Clerk remains authoritative for:

- Authentication.
- User identity and login methods.
- Basic account profile data.

The local database is authoritative only for:

- Pending offline mutations not yet accepted upstream.
- Cached rows that the current user is authorized to access.
- Device-specific UI preferences.
- Sync cursors and local operational state.

## Postgres Toolchain

Adopt Drizzle ORM and Drizzle Kit for the Neon collection work.

This recommendation is about schema ownership and migration safety as much as
query ergonomics:

```text
TypeScript schema definitions
  -> Drizzle Kit generates reviewable SQL migrations
  -> migrations run once against Neon
  -> Drizzle provides typed server queries and transactions
  -> raw SQL remains available for Postgres-specific operations
```

### Why Drizzle fits Tote

- Native Neon HTTP and Neon serverless adapters.
- One TypeScript source for tables, enums, relations, indexes, and inferred row
  types.
- Generated SQL migrations remain visible and reviewable.
- Custom SQL migrations can cover triggers, functions, complex RLS, outbox
  setup, data backfills, and extensions.
- Postgres RLS can be added later as defense in depth without replacing the
  application query layer.
- Typed JSONB columns can model block `properties`.
- Transactions and savepoints are available for atomic mutation application.
- Drizzle Studio offers useful inspection during the migration.
- It is incremental: existing raw SQL does not need to be rewritten before new
  collection tables use Drizzle.

### Drizzle Kit versus Kysely

They solve overlapping but different problems:

| Concern | Drizzle | Kysely |
|---|---|---|
| Typed query builder | Yes | Yes, particularly strong |
| TypeScript schema definition | Yes | Database types only |
| Migration generation from schema diffs | Drizzle Kit | No core schema-diff workflow |
| Handwritten migrations | Yes | Yes |
| Neon-specific adapter | First-class | Uses a compatible dialect/adapter |
| RLS schema declarations | Supported | Usually handwritten SQL |
| Raw SQL escape hatch | Yes | Yes |

Kysely would be a good choice if Tote wanted SQL migrations and the live
database to remain the sole schema authority, with generated TypeScript database
interfaces layered on top. It is especially appealing for teams that prefer
writing complex SQL-shaped queries over ORM-shaped queries.

Tote's immediate problem is broader: a substantial new schema must be designed,
reviewed, migrated, and kept aligned with application types. Drizzle removes
more bespoke tooling in that situation.

Do not combine Drizzle schema definitions with Kysely queries initially. That
would introduce two database type systems and require code generation or glue
without solving a current problem. Drizzle's raw `sql` API can handle exceptional
queries.

### Migration policy

Use:

```text
drizzle-kit generate
review/edit generated migration.sql
drizzle-kit migrate
```

Do not use `drizzle-kit push` against production. Production schema changes must
be represented by committed migration files.

Generated migrations are a starting point, not an approval mechanism. Review
every migration for:

- Destructive table or column changes.
- Locking and rewrite behavior.
- Backfill cost.
- Index creation strategy.
- RLS enablement and default-deny behavior when RLS is introduced.
- Trigger/function ordering.
- Compatibility with old application versions during deployment.

Use custom SQL migrations for:

- Transactional outbox functions or triggers.
- RLS helper functions and policies that are clearer in SQL.
- Data backfills and legacy Jazz mappings.
- Concurrent index creation where deployment tooling supports it.
- Postgres features Drizzle Kit cannot express accurately.

As existing Neon-backed modules enter this migration, port ordinary reads and
writes from raw Neon SQL to the typed Drizzle schema and query builders. Keep
reviewed SQL where PostgreSQL itself is the useful abstraction, including
recursive CTEs, triggers/functions, complex atomic graph operations, and
migration backfills. Repository methods should accept an injectable Drizzle
database so the same query code runs against Neon in production and a
transaction-bound local PostgreSQL client in integration tests.

### Runtime connections

Use the Neon HTTP driver for ordinary one-shot reads and writes and non-
interactive batched transactions.

Use a request-scoped Neon serverless `Pool`/WebSocket connection when an
operation requires an interactive transaction with application logic between
queries. The WebSocket exists only for the duration of the Vercel request; this
does not conflict with Vercel's inability to host persistent client realtime
connections.

Most collection mutations should be expressible as one database transaction:

```text
validate idempotency and membership
apply block operations
increment record versions
insert realtime outbox event
record accepted client transaction
commit
```

Prefer a database function or one-shot transaction when practical. This reduces
round trips and makes the mutation boundary explicit.

### Incremental adoption

1. Add Drizzle dependencies and configuration.
2. Introspect or declare existing tables so queries can coexist safely.
3. Keep the existing SQL migration history as the immutable baseline.
4. Start Drizzle migration history with the new private collection schema.
5. Implement new collection repositories with Drizzle.
6. Migrate existing raw query modules only when they are being materially
   changed.
7. Remove the custom migration runner after all environments use Drizzle Kit.

The current runner splits SQL files on semicolons and executes each statement
separately without wrapping the migration in a transaction. That will become
fragile for Postgres functions, triggers, procedural SQL, and the larger
collection schema. It should not be extended for the new architecture.

### Write path

Ordinary collection mutations should be local-first:

```text
UI mutation
  -> local transaction
  -> immediate reactive UI update
  -> durable upload queue
  -> authenticated mutation endpoint
  -> Neon transaction
  -> change stream back to authorized clients
```

The server must remain authoritative for operations requiring global invariants:

- Claiming or changing a unique public slug.
- Accepting, revoking, or changing membership.
- Consuming a single-use invite.
- Publishing or unpublishing.
- Enforcing billing and feature entitlements.
- Destructive account deletion.

These operations may start optimistically, but their UI must represent pending,
accepted, and rejected states.

## Proposed Relational Model

Use client-generated UUIDs for every offline-creatable entity. UUIDv7 is
preferred when supported consistently; random UUIDv4 is acceptable.

### `app_users`

Minimal application-level identity record.

| Column | Notes |
|---|---|
| `id` | Clerk user ID, primary key |
| `username` | Nullable, unique when present |
| `created_at` | Server timestamp |
| `updated_at` | Server timestamp |
| `deleted_at` | Soft-delete marker |

Do not copy unnecessary Clerk profile data into Postgres.

### `user_preferences`

| Column | Notes |
|---|---|
| `user_id` | Primary key and FK to `app_users` |
| `default_collection_id` | Nullable FK to `collections` |
| `updated_at` | Server timestamp |

Purely visual preferences such as mobile list/grid mode can remain device-local
unless cross-device consistency is a product requirement.

### `collections`

| Column | Notes |
|---|---|
| `id` | Client-generated UUID primary key |
| `owner_user_id` | Clerk user ID |
| `name` | Required |
| `description` | Nullable |
| `color` | Nullable |
| `budget_cents` | Nullable integer |
| `default_view_mode` | `grid` or `table`, nullable |
| `public_layout` | `minimal` or `feature` |
| `allow_cloning` | Boolean |
| `item_count` | Denormalized count of active item-like nodes |
| `position_key` | Ordering in the owner's collection list |
| `origin_type` | `manual`, `import`, `curator`, or `clone` |
| `legacy_jazz_id` | Nullable, unique migration reference |
| `created_at` | Original creation time |
| `updated_at` | Server-maintained |
| `deleted_at` | Tombstone |

Ownership is not the same as membership. The owner should also have an explicit
membership row so authorization queries have one consistent model.

`item_count` is maintained transactionally by Postgres whenever a node is
inserted, hard-deleted, soft-deleted, restored, moved between collections, or
changed between node types. It counts active `product`, `link`, and `photo`
nodes at any nesting depth. Structural and editorial nodes such as `section`,
`note`, and `text` do not count. Collection-card queries read this column without
loading the node tree.

### `collection_members`

| Column | Notes |
|---|---|
| `collection_id` | FK to `collections` |
| `user_id` | Clerk user ID |
| `role` | `owner`, `admin`, `editor`, or `viewer` |
| `created_at` | Server timestamp |
| `updated_at` | Server timestamp |
| `revoked_at` | Nullable |

Primary key: `(collection_id, user_id)`.

### Ownership and RBAC model

A collection has exactly one canonical owner:

```text
collections.owner_user_id
```

All blocks belong to the collection, not to individual users:

```text
blocks.collection_id -> collections.id
```

This means a collaborator-created product does not become a separately owned
object. Its access, retention, publication, and deletion follow the collection.
`blocks.created_by_user_id` records authorship for attribution and audit only; it
does not grant ownership.

The owner also receives a `collection_members` row with role `owner`. The
duplicated owner reference is intentional:

- `collections.owner_user_id` enforces one owner and supports fast ownership
  queries.
- `collection_members` gives all authorization checks one role-based shape.
- A constraint or transactional service command keeps the two values aligned.

Recommended roles:

| Capability | Owner | Admin | Editor | Viewer |
|---|---:|---:|---:|---:|
| Read collection and blocks | Yes | Yes | Yes | Yes |
| Add/edit/move/delete blocks | Yes | Yes | Yes | No |
| Edit collection presentation | Yes | Yes | Yes | No |
| Publish/update public snapshot | Yes | Yes | No | No |
| Create/revoke invites | Yes | Yes | No | No |
| Add/remove editors or viewers | Yes | Yes | No | No |
| Promote/demote admins | Yes | No | No | No |
| Transfer ownership | Yes | No | No | No |
| Delete collection | Yes | No | No | No |
| Make an independent copy | Policy | Policy | Policy | Policy |

Copy permission should not be inferred solely from write access. Use an explicit
collection policy:

```text
collections.copy_policy
  disabled
  members
  public
```

- `disabled`: only the owner can duplicate it for their own use.
- `members`: any active member can make an independent copy.
- `public`: members and users of a cloneable public snapshot can make a copy.

This replaces the less precise `allow_cloning` boolean over time. The UI may
still expose a simple toggle initially.

Important authorization rules:

- There is exactly one active owner.
- The owner membership cannot be removed or demoted directly.
- Ownership transfer changes `owner_user_id` and both affected membership rows
  atomically.
- An admin cannot grant a role equal to or above owner.
- An admin cannot remove or demote the owner.
- A user cannot elevate their own role.
- Removing a member revokes access to the existing graph but does not affect
  copies they already own.
- Account deletion must transfer or explicitly delete owned shared collections;
  it must not silently orphan them.

### User-specific collection state

Do not store a collaborator's personal organization on the shared collection
row. Use a separate table where needed:

```text
collection_user_state
  collection_id
  user_id
  position_key
  is_favorite
  is_archived
  last_opened_at
```

This lets two users order or archive the same shared collection differently
without mutating shared content.

### `collection_invites`

| Column | Notes |
|---|---|
| `id` | UUID primary key |
| `collection_id` | FK |
| `created_by_user_id` | FK |
| `role` | Role granted on acceptance |
| `token_hash` | Hash of the bearer token, never store the raw token |
| `expires_at` | Nullable |
| `max_uses` | Nullable |
| `use_count` | Server-maintained |
| `revoked_at` | Nullable |
| `created_at` | Server timestamp |

Invite acceptance must be an online server transaction. Invite links are bearer
credentials and should be revocable.

Invite acceptance:

1. Hash and validate the presented bearer token.
2. Verify expiry, revocation, and remaining uses.
3. Upsert the user's membership with the invite role.
4. Increment use count.
5. Emit membership and collection-index realtime events.
6. Commit all effects atomically.

Invites may grant `viewer`, `editor`, or `admin`. Owner is never inviteable.

### Collection team management

Owners and admins need a collection-level team screen rather than managing
collaboration only through one-off share links.

The screen should show:

- Active collaborators with display name, email/username where available, role,
  inviter, and joined date.
- Pending invites with intended recipient where known, granted role, creator,
  creation time, expiry, use count, and status.
- Revoked and expired invites in a lightweight history view.
- The current owner clearly distinguished from other collaborators.

Supported actions:

- Owners and admins can invite viewers or editors.
- Owners and admins can remove viewers or editors.
- Owners and admins can change a collaborator between viewer and editor.
- Owners can promote or demote admins.
- Owners can transfer ownership through a separate confirmed flow.
- Owners and admins can revoke pending invites and create replacement links.
- Admins cannot alter or remove the owner, another admin, or themselves into a
  more privileged role.

Membership and invite changes should record actor, previous role, next role,
reason/action, and server timestamp in an audit table or event stream. Revoking
a member must invalidate future sync access and trigger local-data purge on
connected clients. Invite tokens remain write-only bearer credentials: the team
screen displays metadata and status, never the stored token hash or a previously
issued raw token.

### `collection_sections`

This replaces Jazz slot blocks.

| Column | Notes |
|---|---|
| `id` | Client-generated UUID primary key |
| `collection_id` | FK |
| `name` | Required |
| `description` | Nullable |
| `budget_cents` | Nullable integer |
| `max_selections` | Nullable integer |
| `position_key` | Stable ordering key |
| `created_at` | Client creation time, validated |
| `updated_at` | Server-maintained |
| `deleted_at` | Tombstone |

### `collection_items`

Each row is one saved product occurrence. It is not a global product catalogue
record. Saving the same URL into two collections creates two independently
editable rows.

| Column | Notes |
|---|---|
| `id` | Client-generated UUID primary key |
| `collection_id` | FK |
| `section_id` | Nullable FK; null means top-level item |
| `title` | Required display title |
| `url` | Required original/canonical URL |
| `normalized_url` | Used for duplicate detection |
| `description` | Nullable |
| `personal_notes` | Nullable |
| `image_url` | Nullable |
| `images` | JSONB array or child table |
| `price_text` | Original display value |
| `price_minor` | Nullable integer in minor currency units |
| `currency` | Nullable ISO currency code |
| `brand` | Nullable |
| `merchant` | Nullable |
| `is_selected` | Boolean |
| `position_key` | Stable ordering key within section/top level |
| `metadata` | JSONB for extractor fields not yet promoted to columns |
| `created_at` | Client creation time, validated |
| `updated_at` | Server-maintained |
| `deleted_at` | Tombstone |

`price_minor` plus `currency` should become the calculation source. `price_text`
is retained for fidelity and migration of current values.

If an item moves between top level and a section, update `section_id` and
`position_key` in one transaction.

### `collection_notes`

This replaces the collection-level `CollectionNote` list.

| Column | Notes |
|---|---|
| `id` | Client-generated UUID primary key |
| `collection_id` | FK |
| `text` | Required |
| `url` | Nullable |
| `is_done` | Boolean |
| `position_key` | Stable ordering key |
| `created_at` | Client creation time, validated |
| `updated_at` | Server-maintained |
| `deleted_at` | Tombstone |

### `collection_origins`

Keep curator and clone provenance out of the core collection row.

| Column | Notes |
|---|---|
| `collection_id` | Primary key and FK |
| `curator_session_id` | Nullable FK |
| `source_publication_id` | Nullable FK |
| `topic` | Nullable |
| `brief_json` | Nullable JSONB |
| `origin_version` | Nullable integer |
| `imported_at` | Nullable timestamp |

### Copy and lineage model

Sharing and copying are different operations:

```text
Share:
  same collection ID
  same block IDs
  membership row added
  future edits remain collaborative

Make a copy:
  new collection ID
  new block IDs
  requesting user becomes sole owner
  no members copied
  no invites copied
  no live synchronization with source
  lineage edge recorded
```

The copy is a snapshot of the source at one accepted server version. Later edits
to either graph do not propagate to the other.

Create collection-level provenance:

```text
collection_lineage
  id
  child_collection_id
  relationship          copied | imported | curated | templated
  source_collection_id  nullable
  source_publication_id nullable
  source_owner_user_id  nullable
  source_version        nullable
  source_name_snapshot
  source_ref            nullable
  created_by_user_id
  created_at
```

`child_collection_id` is the new collection. A collection may eventually have
more than one lineage edge, which permits imports or future merge workflows to
form a graph rather than a single `copied_from_id` chain.

Use nullable or non-enforced references for source records that may be deleted.
Deleting the source must not delete the copy or its provenance watermark.
Snapshot fields preserve a minimal explanation after source deletion.

For block-level graph analysis, add:

```text
block_lineage
  child_block_id
  source_block_id
  relationship       copied
  created_at
```

Block lineage is useful for:

- Understanding which products survive through multiple copies.
- Measuring template or public-list reuse.
- Detecting repeated edits to the same copied recommendation.
- Supporting a future "show changes from source" feature.

It is not required for authorization and should not be exposed publicly by
default. Collection-level lineage is sufficient for the first release if
block-level analytics is not yet valuable.

The copy transaction must:

1. Verify the actor can read the source and its `copy_policy` permits copying.
2. Lock or read the source at one consistent database snapshot/version.
3. Generate a new collection UUID.
4. Generate new UUIDs for every copied block.
5. Remap all parent IDs and internal block references to the new IDs.
6. Insert the new collection with the actor as owner.
7. Insert only the actor's owner membership.
8. Insert copied blocks and optional block-lineage rows.
9. Insert the collection-lineage edge.
10. Exclude source memberships, invites, publication state, comments/history,
    sync metadata, and tombstones.
11. Commit the entire graph copy atomically.

Fields copied by default:

- Collection name, description, color, layout, and budget.
- Sections, products, collection notes, ordering, and selections.
- Product metadata and personal notes visible to the copying user.
- Curator-derived content that is part of the collection.

Fields reset:

- Owner and membership.
- Invite tokens.
- Public slug and publication rows.
- Created/updated versions and mutation metadata.
- Legacy Jazz ownership/group identifiers.
- User-specific favorite, archive, and ordering state.

The new collection can use a name such as `Copy of {source name}`, but the stored
lineage edge, not the title, is the durable watermark.

### Provenance privacy

Lineage is operator-readable metadata. User-facing exposure should follow the
source visibility:

- A copy owner can see that their collection was copied and the source name
  snapshot.
- A currently accessible source may be linked.
- A private source the user can no longer access must not become discoverable
  through its ID, owner, title, or contents.
- Public attribution can show the published source and creator when product
  policy calls for it.
- Source owners should receive aggregate reuse counts only if disclosed in the
  privacy policy; they should not automatically gain access to downstream
  private copies or the identities of people who copied them.

### Publications

Keep publication as an explicit snapshot, rather than exposing live private
tables directly.

Recommended evolution of the existing model:

```text
collection_publications
  id
  source_collection_id
  owner_user_id
  username
  slug
  name
  description
  color
  layout
  allow_cloning
  source_updated_at
  published_at
  updated_at
  unpublished_at

publication_sections
publication_items
```

Benefits:

- Publishing remains explicit and reviewable.
- Private edits do not leak immediately.
- Public SSR and SEO remain straightforward.
- Unpublishing removes the application-controlled public copy.
- Published data can be optimized independently from the editing model.

The current `published_collections` and `published_blocks` tables can be migrated
instead of replaced wholesale.

## Ordering

Do not model user-visible order with contiguous integers that require rewriting
an entire list on every drag.

Use a lexicographically sortable fractional position key:

```text
a0
a1
a1V
a2
```

Inserting between two rows generates a key between their keys. Requirements:

- Deterministic tie-breaking by row ID.
- Occasional server-side compaction when keys become long.
- Moving an item updates one row in the common case.
- Reorder operations remain usable offline.

This applies to collections, sections, items, and collection notes.

## Sync and Conflict Semantics

These rules must be specified before UI migration.

### Identity and idempotency

- Every mutation has a client-generated `mutation_id`.
- The server records recently applied mutation IDs per user/device.
- Retrying an upload must not duplicate rows or side effects.
- Every device has a stable `device_id` for diagnostics, not authorization.

The first implemented path is collection creation. Idempotent creates require
both a client-generated collection UUID and mutation UUID. PostgreSQL inserts
the collection, owner membership, and `collection_mutation_receipts` row in one
statement. The receipt stores the operation, canonical request fingerprint,
replayable response, and expiry. An identical retry returns the original
collection UUID; reusing a mutation UUID with different input returns a
conflict. Extend this receipt pattern to node and scalar mutations before those
commands are accepted from an offline queue.

### Creates

- IDs are generated before network access.
- Replaying the same create is a no-op if its mutation ID was accepted.
- An ID collision with different content is rejected and logged.

### Scalar edits

Recommended first version: field-level last-write-wins for ordinary descriptive
fields, using server-assigned versions when mutations are accepted.

Avoid replacing whole rows from stale clients. Upload patches containing only the
fields the user changed.

### Deletes

- Deletion writes a tombstone; it does not immediately hard-delete.
- Tombstones sync to all authorized clients.
- Retain tombstones long enough to cover realistically dormant devices.
- Hard deletion is an asynchronous retention task.
- Restoring a deleted row, if supported, is an explicit new mutation.

### Concurrent moves and reorders

- `section_id` and `position_key` form one logical move.
- Last accepted move wins.
- Fractional keys avoid broad reorder conflicts.

### Selection limits

`max_selections` is a cross-row invariant. Offline clients can temporarily exceed
it when collaborators select concurrently.

Choose one policy:

1. Treat the limit as advisory and display an over-limit state.
2. Reject the later server mutation and surface a sync conflict.
3. Add a server-side transactional selection command that requires connectivity.

The first policy best preserves offline behavior and avoids silently discarding a
user's selection.

### Conflict visibility

Most conflicts can resolve silently, but the client needs a durable error surface
for rejected mutations:

- Permission was revoked.
- Parent collection was deleted.
- Invite expired.
- Unique slug was taken.
- Server validation failed.

Do not leave failed changes permanently looking synced.

## Authorization and Security

### Database authorization

Use Clerk user IDs as the external identity in authorization checks.

Every collection query and mutation must require an active
`collection_members` row. The required initial security boundary is Tote's
authenticated server API:

```text
client
  -> Clerk-authenticated Tote endpoint
  -> authorization in the collection repository/service
  -> privileged server-only Neon connection
```

Clients never receive a Neon connection string or query private collection
tables directly.

RLS is a later defense-in-depth improvement, not a launch dependency. Repository
methods should still be structured so it can be added cleanly:

- Require `actorUserId` for every private collection operation.
- Centralize membership and role checks.
- Avoid generic unrestricted table access in route handlers.
- Test authorization at the service boundary.
- Keep background-worker and migration access explicit.

Required application authorization tests:

- Owners can read and mutate all collection rows.
- Editors can mutate content but not ownership.
- Viewers cannot mutate.
- Revoked members receive no further rows.
- A child row cannot be accessed independently of its parent collection.
- Public snapshot tables expose only currently published rows.

When RLS is introduced, repeat this matrix as database policy tests. RLS should
reinforce the application rules rather than become the first place those rules
are defined.

### Revocation caveat

Removing access stops future sync and the app should purge the collection from
its local database. It cannot make a user forget plaintext that was already
synced to a device while they were authorized.

### Encryption decision

Neon's TLS and storage encryption are necessary but are not E2EE.

Before migration, choose and document one model:

#### Model A: server-readable private data

- Neon stores application-readable collection data.
- Access is restricted by authentication, membership, RLS, and operational
  controls.
- Tote can provide server-side search, AI, support, monitoring, and recovery.
- Marketing uses "private by default," not "only you can read it."

#### Model B: optional sealed collections

- Sensitive fields are encrypted on device with a collection key.
- Membership rows and sync metadata remain readable for replication.
- The key is wrapped separately for each authorized user/device.
- Server-side features require explicit worker key access.
- Search, previews, extraction refresh, and recovery need encrypted-mode-specific
  designs.

Do not attempt Model B as an incidental migration detail. It is a separate
security product with key recovery, rotation, device enrollment, sharing, and
revocation requirements.

## Client Requirements

### Shared data-access package

Create a platform-neutral domain package that exposes:

- Collection queries.
- Mutation commands.
- Typed row models.
- Authorization roles.
- Position-key generation.
- Sync status and mutation errors.
- Import/export serializers.

React components should not call Jazz, Neon, or a sync SDK directly.

### Web

Replace `useAccount` and `useCoState` in active collection routes with server
reads and TanStack Query hooks. Keep the classic Jazz provider mounted only for
the migration and rollback window.

Requirements:

- React Server Components fetch authoritative collection list/detail state.
- `HydrationBoundary` seeds the same stable query keys used by client hooks.
- TanStack Query owns optimistic mutations, retries, invalidation, and pending
  state.
- `PersistQueryClientProvider` persists eligible query and mutation state to an
  account-scoped IndexedDB database.
- Persisted mutation keys register default `mutationFn` handlers so paused
  mutations can resume after a reload.
- Query `gcTime` must be at least the persistence `maxAge`.
- Cache keys include a schema/version buster and are cleared on sign-out.
- Multi-tab coordination.
- Offline create/edit/delete/reorder.
- Route access by collection UUID.
- Sync status and rejected-mutation UI.
- SSR remains server-backed for public pages.

Stable collection query keys:

```text
["collections"]
["collections", collection_id]
["collections", collection_id, "team"]
```

The persisted Query cache is the initial web device cache. Pending mutations are
durable user intent and must be dehydrated independently of ordinary query cache
eviction. Add a separate domain outbox only if TanStack's persisted paused
mutations prove insufficient for conflict inspection, attachment uploads,
migration support, or explicit user-facing retry management.

### Mobile

Mobile already includes `expo-sqlite`, making SQLite a natural local store.

Requirements:

- Database initialization before collection screens render.
- Background/reconnect sync.
- Share-sheet saves that work without connectivity.
- Durable queued writes across app termination.
- Secure token storage.
- Local database purge on sign-out or membership revocation.
- Migration from the existing Jazz local store.

### Chrome extension

The extension primarily needs:

- List writable collections and sections.
- Create collections and sections.
- Save products while the popup is open.
- Preserve the last selected collection.
- Queue a save when temporarily offline.

Running a full browser SQLite sync client inside a Manifest V3 extension may
have lifecycle, WASM, CSP, and storage constraints. Perform a dedicated spike.

Acceptable fallback:

- Extension reads a small collection index from local extension storage.
- Online writes go through the Tote API.
- Offline saves enter a durable extension outbox.
- The web app or extension flushes that outbox later.

The extension does not need to mirror the full collection-detail experience in
the first migration phase.

## Sync Technology Options

### Neon-recommended realtime: Ably LiveSync

Neon's real-time comments guide recommends pairing Neon Postgres with Ably
LiveSync for Vercel-hosted Next.js applications.

The architecture avoids running long-lived WebSocket servers on Vercel:

```text
Browser / mobile client
  -> HTTPS mutation -> Vercel route
  -> Postgres transaction:
       mutate Tote rows
       insert matching outbox event
  -> Ably Postgres connector
  -> Ably-hosted WebSocket channel
  -> subscribed clients
```

The connector detects inserts into the Postgres outbox using `LISTEN/NOTIFY`,
claims the rows, publishes them to Ably channels, and removes processed rows
while retaining the latest sequence marker.
The application data change and its outbound event are written in one Postgres
transaction, avoiding a successful database write with a missing realtime event.

Use the connector-compatible tables rather than a Tote-specific queue shape:

```sql
CREATE TABLE ably_nodes (
  id TEXT PRIMARY KEY,
  expiry TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE TABLE ably_outbox (
  sequence_id SERIAL PRIMARY KEY,
  mutation_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  name TEXT NOT NULL,
  rejected BOOLEAN NOT NULL DEFAULT false,
  data JSONB,
  headers JSONB,
  locked_by TEXT,
  lock_expiry TIMESTAMP WITHOUT TIME ZONE,
  processed BOOLEAN NOT NULL DEFAULT false
);
```

The migration also installs the connector's statement-level `AFTER INSERT`
trigger, which calls `pg_notify('ably_adbc', '')`. `locked_by`, `lock_expiry`,
and `processed` belong to the connector and application writes must not set
them.

Suggested channel partitioning:

```text
user:{clerk_user_id}:collections
collection:{collection_id}
```

- The user channel invalidates or updates the collection index.
- The collection channel carries block deltas for one open collection.
- Ably token capabilities must restrict each client to channels backed by active
  collection membership.
- Never expose an Ably API key in `NEXT_PUBLIC_*`. The Neon tutorial uses that
  shortcut for demonstration; production clients should receive short-lived
  Ably tokens from an authenticated Tote endpoint.

Each mutation should:

1. Generate a stable `mutation_id` on the client.
2. Apply an optimistic local transaction.
3. Send the mutation over HTTPS to a Vercel route.
4. Validate membership and expected record versions.
5. Commit block changes plus an outbox delta in one Neon transaction.
6. Receive the confirmed event over Ably with the same `mutation_id`.
7. Confirm or roll back the optimistic transaction.

For the initial TanStack implementation, realtime messages are authoritative
invalidation hints. On channel attach, immediately invalidate/refetch the
corresponding query once to close the race between the RSC/API read and the
subscription becoming active. Then apply targeted invalidation for subsequent
events.

If Tote later needs deterministic stream replay, initial state should be read in
one database transaction together with the latest outbox `sequence_id`. Ably can
then replay events newer than that checkpoint before continuing with live
events.

Prefer delta events:

```json
{
  "blockId": "uuid",
  "version": 14,
  "changes": {
    "parentId": "section-uuid",
    "positionKey": "a1V"
  }
}
```

For more complex transactions, an event can list all changed and deleted record
IDs and let clients fetch authoritative records by version. This keeps event
payloads smaller and makes the database, rather than the event log, the lasting
source of truth.

Do not adopt Ably Models in the first implementation. Its optimistic state and
initial-model synchronization overlap with TanStack Query. Tote will use Ably
Pub/Sub as transport and keep one client state owner.

#### What Ably LiveSync solves

- Long-lived WebSocket connections outside Vercel.
- Low-latency fan-out to active collaborators.
- Ordered event publication from the transactional outbox.
- Connection recovery and short-gap event replay.
- Optimistic mutation confirmation using `mutation_id`.
- Channel-level subscription authorization.

#### What it does not solve by itself

- A durable, queryable device-side cache.
- Offline reads after browser/app restart.
- A mutation queue that can remain pending for hours or days.
- Automatic Postgres-to-SQLite replication.
- Tombstone retention and local purge.
- Domain-specific conflict semantics.
- Client database schema migrations.

Therefore Ably can be used in two ways:

##### Realtime-first, custom offline layer

```text
IndexedDB on web / SQLite on mobile
  -> custom durable transaction queue
  -> Vercel mutation API
  -> Neon + transactional outbox
  -> Ably realtime confirmation and collaboration
```

This resembles the Notion architecture most closely, but Tote owns the local
cache, outbox, sync cursors, and conflict handling.

##### Chosen first web implementation

```text
RSC initial state
  -> TanStack Query state + optimistic updates
  -> account-scoped IndexedDB persistence
  -> Vercel mutation API
  -> Neon + transactional Ably outbox
  -> targeted query invalidation
```

This supplies durable cached reads and paused mutation resumption on web without
claiming to be a general Postgres replication engine. Attachments, complex
multi-record conflicts, revoked-access purging, and long-lived rejected
mutations may still require a Tote-owned device outbox.

#### Cost characteristics

Ably LiveSync adds a second usage meter beyond Neon:

- Base Ably plan.
- Connection minutes or monthly active users, depending on plan.
- Published messages.
- One delivered message per subscribed client.
- Bandwidth and channel limits.

An update with three subscribed clients generally counts as one inbound message
and three outbound deliveries. Channel design therefore affects cost:

- Do not subscribe every client to every accessible collection.
- Subscribe to the collection index plus currently open collections.
- Pause or dispose subscriptions when views are not active.
- Batch transaction deltas into one message when practical.
- Avoid broadcasting full collection snapshots on every small edit.

This can still be inexpensive at Tote's current scale, but a Neon-plus-Ably
comparison must include Ably rather than comparing Neon database cost alone to
Jazz.

### Option 1: PowerSync with Neon

Best current fit for a Neon-canonical architecture.

Pros:

- Purpose-built Postgres-to-SQLite synchronization.
- Official Neon integration.
- React Native/Expo and web SDKs.
- Local writes and durable upload queue.
- Partial replication by authenticated user.

Risks and work:

- Additional hosted or self-hosted infrastructure.
- Authorization must be expressed both in sync configuration and mutation APIs.
- Extension compatibility needs a spike.
- Conflict behavior still needs product-level decisions.
- E2EE is not automatic.

### Option 2: Custom API plus local SQLite/outbox

Pros:

- Full control.
- No additional sync vendor.
- Can be introduced incrementally by client.

Risks:

- Tote owns cursors, delta feeds, subscriptions, retries, tombstones,
  idempotency, conflict handling, migrations, and observability.
- Highest engineering and correctness burden.

This is reasonable only if offline collaboration requirements are reduced.

### Option 3: Jazz v2 as canonical database

Pros:

- Local-first behavior remains a database responsibility.
- Query-driven replication, permissions, history, and offline writes are built
  into the same system.
- Conceptually closest to the current development model.

Risks:

- It does not make Neon the collection source of truth.
- v2 is alpha and has an entirely new API.
- Its trusted-server permission model differs from classic Jazz.
- Tote would still maintain Neon projections for existing server workflows.

### Option 4: Neon canonical plus writable Jazz v2 cache

Not recommended.

This creates two databases with independent:

- Row histories.
- Authorization.
- Schema migrations.
- Conflict resolution.
- Offline mutation queues.
- Server clocks and transaction boundaries.

Making this reliable requires building the sync system the architecture was
intended to avoid.

## Migration Strategy

The server cannot centrally backfill private classic Jazz collections because it
does not currently possess universal read access. Migration must happen from an
authorized client.

### Transition decision

Keep classic Jazz in the application for a defined transition period. Migration
is per account, not a single global cutover:

- Existing accounts continue reading classic Jazz until their migration is
  complete and verified.
- New accounts can start directly on Neon once the Neon path is production
  ready.
- A migrated account uses Neon as its writable authority.
- Classic Jazz remains available read-only for migrated accounts during the
  rollback and support window.
- The application must continue shipping enough classic Jazz code to discover,
  load, export, and diagnose legacy data until the migration program is closed.

Use an account-level data-source state rather than inferring migration from the
presence of Neon rows:

```text
classic_jazz
migrating
neon_verifying
neon
migration_failed
```

Only switch an account to `neon` after the importer has committed, structural
counts and source fingerprints have been verified, and the client has persisted
the migration receipt. A failed or interrupted migration remains retryable and
must not modify the authoritative Jazz graph.

### Migration experience and retention

Migration should begin automatically for eligible signed-in accounts rather
than depending on users discovering a migration button:

1. Export and import the account's Jazz data in the background.
2. Verify source fingerprints, collection counts, item counts, and ID mappings.
3. Ask the user to confirm before switching their active data source to Neon.
4. Keep classic Jazz read-only for 14 days after the confirmed cutover.
5. Provide an internal rollback control during that window.
6. Provide a visible manual retry action when automatic migration fails.

After 14 days, local Jazz caches may be removed when the migration remains
healthy. Do not promise or initiate remote Jazz deletion until its deletion,
replication, and retention semantics have been verified. Keep the migration
receipt and legacy ID mappings after local cleanup for support, idempotency, and
audit purposes.

Legacy account migration is a web-only responsibility. The web app owns the
classic Jazz exporter, Neon importer, verification, confirmation, retry, and
14-day rollback experience.

The iOS app does not need to ship classic Jazz migration code because it has no
external users during this transition. Its current test account data can be
reset and recreated cleanly before the Neon-backed mobile build is used. This
does not remove the need to implement the new mobile data layer and offline
cache; it only removes legacy Jazz compatibility from the mobile scope.

### Per-account migration flow

1. User signs in with the current client.
2. Client fully loads owned collections, descendants, notes, preferences, and
   known shared references from Jazz.
3. Client converts the graph to the relational import format.
4. Client sends an idempotent migration batch to the server.
5. Server validates and commits each owned collection transactionally.
6. Server returns the new UUID mapping.
7. Client stores a migration receipt locally and in Neon.
8. Client switches collection reads and writes to the new local database.
9. Classic Jazz becomes a read-only fallback for a defined rollback period.

### Migration tracking

Add:

```text
account_collection_migrations
  user_id
  migration_version
  status
  source_collection_count
  source_item_count
  imported_collection_count
  imported_item_count
  started_at
  completed_at
  source_fingerprint
  error_json
```

And retain `legacy_jazz_id` on migrated collections and rows where useful.

### Shared collections

Shared data is the hardest migration case.

Requirements:

- Migrate a collection once, under its owner.
- Resolve existing Jazz account IDs to Clerk user IDs where possible.
- Reconstruct member roles only from trustworthy membership data.
- Avoid importing a collaborator's cached copy as a second owned collection.
- Define behavior when a collaborator migrates before the owner.
- Issue new Neon-backed invite links after cutover.

Recommended first policy:

- Owners migrate shared collections.
- Collaborators see a temporary "waiting for owner migration" state.
- Provide an explicit "copy to my collections" escape hatch if the owner never
  migrates.

### Published collections

Published snapshots already in Neon should be linked to the new source
collection UUID during migration using `source_jazz_id`.

This is also a versioned data migration for the existing
`published_collections` and `published_blocks` rows:

1. Keep the existing publication ID, username, slug, timestamps, and public URL.
2. Resolve `published_collections.source_jazz_id` to the migrated
   `collections.legacy_jazz_id`.
3. Backfill the new `source_collection_id`.
4. Convert `slot` blocks to publication sections and `product` blocks to
   publication items while preserving order and parent relationships.
5. Record a publication schema version and migration status so the conversion
   is idempotent and auditable.
6. Verify collection metadata, block counts, parent relationships, and a
   deterministic snapshot fingerprint before marking the publication migrated.

The current publication tables must remain readable throughout the conversion;
public links should not depend on the owner's private-account cutover being
complete. Publications that cannot yet resolve a source collection continue
serving their existing snapshot and are retried later.

Do not republish automatically from the newly migrated private collection.
Preserve the exact current public snapshot and let the next explicit publish
update it from the new model.

### Avoid broad dual-write

Do not run indefinite Jazz-plus-Neon writes.

If a short dual-write window is required:

- Make one system authoritative per account.
- Record the cutover instant.
- Mirror only after the authoritative write succeeds.
- Monitor mismatches.
- Set a firm removal date.

## Delivery Phases

### Pre-release iteration slices

Each slice should be deployable without enabling the Neon collection path for
existing users. Use account-level source flags and internal account allowlists
instead of maintaining a long-lived global branch.

1. **Database foundation**
   - Drizzle schema, reviewed migrations, collection/node/member tables,
     denormalized `item_count`, lineage, and migration receipts.
   - Exit: migrations validate and focused schema/domain tests pass.
2. **Server-only collection API**
   - Authorized collection list/detail/create/update/delete and node mutations.
   - Exit: API integration tests cover owner/editor/viewer behavior and
     idempotent retries; no production UI uses it.
3. **Internal web read path**
   - Render Neon collections for allowlisted internal accounts while Jazz
     remains authoritative for everyone else.
   - Exit: collection cards and details match expected data, including
     `item_count`.
4. **Internal web write path**
   - Add connector-compatible realtime outbox tables and emit transactionally
     from every accepted collection mutation.
   - Add TanStack Query hydration and optimistic, durable mutations.
   - Neon-authoritative create/edit/delete/move/reorder for internal accounts.
   - Exit: normal editing works without Jazz dual-write and failure states are
     observable; every committed mutation has one matching outbox event.
5. **Local web cache and offline behavior**
   - Persist eligible TanStack queries and paused mutations to account-scoped
     IndexedDB, then add reconnect handling and multi-tab coordination.
   - Exit: offline edits survive restart and reconcile across two browsers.
6. **Publication v2**
   - Add independent publication snapshot tables, explicit publish/republish,
     and the legacy publication conversion job.
   - Exit: public URLs remain stable, private unpublished edits stay private,
     and converted snapshots match fingerprints.
7. **Sharing and copies**
   - Collection team screen for owners/admins, member listing, pending invite
     tracking, role changes, removal, invite revocation, and ownership transfer.
   - Role enforcement, revocation/local purge, and row-duplicating "make a
     copy" with lineage.
   - Exit: access-matrix, team-management audit, invite lifecycle, revocation,
     and copy-isolation tests pass.
8. **Web-only Jazz migration**
   - Automatic export/import, receipt verification, user-confirmed cutover,
     retry/support tooling, and 14-day read-only rollback.
   - Exit: representative internal accounts migrate repeatedly and
     idempotently, including shared and published collections.
9. **Realtime client**
   - Add authenticated Ably subscriptions and targeted TanStack Query
     invalidation after the core web feature set and migration flow are stable.
   - Exit: two active collaborators receive collection/index updates without
     polling, and reconnect closes the initial-read subscription gap.
10. **Mobile and capture**
   - Neon-backed iOS local data layer, share-sheet capture, and extension
     capture. Reset the internal iOS Jazz data instead of migrating it.
   - Exit: queued captures and edits survive process termination and reconnect.
11. **Release cohorts**
    - New accounts first, then opt-in existing accounts, then progressively
      larger migration cohorts.
    - Exit: migration, sync, authorization, and publication health remain
      within agreed operational thresholds.

### Phase 0: decisions and spikes

- Choose server-readable versus E2EE privacy model.
- Validate the TanStack Query, IndexedDB, Neon, and Ably path on web.
- Keep a PowerSync spike as a fallback evaluation for mobile replication.
- Validate Clerk authentication through Tote's mutation and query APIs.
- Validate web persistence and multi-tab behavior.
- Validate Expo background/offline behavior.
- Test Manifest V3 extension feasibility.
- Define conflict UX and retention periods.

Exit criterion: one user can create, edit, reorder, delete, and sync a sample
collection across web and mobile while repeatedly going offline.

### Phase 1: schema and domain layer

- Add private collection tables and indexes.
- Add centralized application authorization and role-matrix tests.
- Add typed domain models and mutation commands.
- Implement fractional ordering.
- Implement tombstones and mutation idempotency.
- Implement collection/member queries.

RLS can follow after the core query paths and background-worker requirements are
stable.

### Phase 2: web vertical slice

- Collection list and detail reads from local SQL.
- Create/edit/delete collections.
- Add/edit/delete/move/reorder products and sections.
- Notes, budgets, and selections.
- Sync status and error handling.

Keep classic Jazz available behind an account-level source flag.

### Phase 3: mobile and capture

- Replace the iOS Jazz data path with the Neon-backed local data layer.
- Reset and recreate the existing internal iOS test data rather than migrating
  it from classic Jazz.
- Port mobile collection list/detail flows.
- Port mobile share-sheet save.
- Port extension collection picker and save.
- Verify queued capture survives process termination.
- Do not ship the classic Jazz exporter, migration state machine, or rollback UI
  in the iOS app.

### Phase 4: sharing and publishing

- Neon membership, tracked invites, and membership audit events.
- Owner/admin collection team management UI.
- Role changes, collaborator removal, invite revocation, and ownership
  transfer.
- Role enforcement and revocation-driven local purge.
- Public snapshot publishing.
- Cloning from public snapshots.

### Phase 5: migration

- Build the web-only classic Jazz exporter and migration experience.
- Build idempotent Neon importer.
- Handle shared-owner sequencing.
- Link existing publications.
- Add migration observability and support tooling.
- Roll out by internal account, cohort, then all users.

### Phase 6: retire classic Jazz

- Stop new Jazz collection writes.
- Maintain read-only fallback through the announced rollback window.
- Export or delete remaining accessible data according to policy.
- Remove Jazz providers and CoValue-specific UI code.
- Update marketing and privacy documentation.

## Test Requirements

### Test layers

Use three complementary layers during the transition:

1. Pure Vitest tests for role matrices, request validation, item-count
   contribution rules, migration receipt verification, and conflict helpers.
2. Disposable local PostgreSQL integration tests for committed migrations,
   constraints, triggers, deterministic seed fixtures, recursive mutations, and
   denormalized summaries.
3. API integration tests against an isolated deployed or local app once the
   authenticated Neon endpoints are enabled for internal accounts.

Run the local database suite with:

```text
pnpm test:db
```

The command creates a temporary PostgreSQL cluster, applies the committed
Drizzle migrations, loads `src/db/seeds/collections.integration.sql`, runs the
SQL assertions, and deletes the cluster. It never uses the configured Neon URL.
PostgreSQL 15 or newer must be installed locally. The deterministic seed includes
owner/admin/editor/viewer memberships, migration receipts, a legacy Jazz
mapping, publication migration state, sections, and generalized item types.

TypeScript database tests use the exported `dbTest` Vitest fixture. Every test
receives a dedicated PostgreSQL connection, begins a transaction automatically,
and rolls it back after the test. Fishery factories persist rows through
`onCreate`; they resolve the active test database by default and accept
`{ transient: { db } }` when a test needs an explicit client. Integration test
files run sequentially while using the shared delegate. Tests that later need
parallel execution should use explicit transient clients or separate databases
per worker.

### Data model

- FK and check constraints.
- Role and RLS matrix.
- Idempotent create/update/delete.
- Tombstone propagation.
- Moving items between sections.
- Ordering-key collision and compaction.
- Publication snapshot isolation.

### Offline and concurrency

- Create and edit while offline, kill app, reopen, reconnect.
- Two devices edit different fields.
- Two devices edit the same field.
- Concurrent reorder.
- Delete versus edit.
- Revocation while a device is offline.
- Concurrent selections exceeding a limit.
- Duplicate mutation upload.

### Migration

- Empty account.
- Large collection.
- Top-level products and nested slots.
- Product and collection notes.
- Published collection.
- Shared owner, editor, and viewer.
- Partially loaded or malformed legacy data.
- Interrupted and retried migration.

## Observability and Operations

Required operational signals:

- Sync connection state by client/version.
- Pending mutation age and queue depth.
- Mutation rejection reason.
- Replication lag.
- Tombstone backlog.
- Migration status and failure reason.
- Authorization failures, and later RLS policy failures.
- Publication mismatch between source and snapshot.

Support tooling should expose metadata and sync health without requiring broad
access to collection content unless the chosen privacy model permits it.

## Initial Scope Estimate

Relative size, not calendar estimates:

| Workstream | Size | Risk |
|---|---:|---:|
| Neon schema and RLS | Medium | Medium |
| Shared domain/data-access layer | Large | Medium |
| Web collection migration | Large | Medium |
| Mobile migration | Large | High |
| Extension capture migration | Medium | High |
| Offline conflict/error UX | Large | High |
| Sharing and invites | Large | High |
| Publishing simplification | Medium | Low |
| Client-side Jazz migration | Large | High |
| E2EE, if retained | Very large | Very high |

The architecture is feasible, but it is a data-platform migration rather than a
database swap.

## Decisions Required Before Implementation

1. Is private collection content server-readable, optionally encrypted, or E2EE?
2. Is offline mutation required on web, mobile, and extension, or only mobile?
3. Must viewer-role collections be available offline?
4. Are selection limits advisory or strictly enforced?
5. How long should tombstones and classic Jazz rollback data be retained?
6. Can existing shared collections wait for owner-led migration?
7. Is PowerSync Cloud acceptable, or must sync infrastructure be self-hosted?
8. Should browser clients sync every accessible collection or only recently
   opened collections?
9. Is collection edit history a launch requirement or a later feature?
10. What is the acceptable migration fallback when legacy Jazz data fails to
    load completely?

## Recommended Next Step

Build a narrow PowerSync/Neon spike using four tables:

- `collections`
- `collection_members`
- `collection_sections`
- `collection_items`

Implement only:

- Clerk-authenticated sync.
- Collection list.
- Collection detail.
- Create item.
- Edit title.
- Reorder item.
- Delete item.
- Offline restart and reconnect.

Run it on web and Expo before committing the production schema. The spike should
measure cold-start time, reconnect behavior, local database size, mutation
latency, and the extension feasibility boundary.

# Tote iOS App - Development Guide

**See [../PRODUCT.md](../PRODUCT.md) for product principles and values.**
**See [../docs/MOBILE_ROADMAP.md](../docs/MOBILE_ROADMAP.md) for the feature roadmap.**
**See [../docs/MOBILE_FEATURE_PARITY.md](../docs/MOBILE_FEATURE_PARITY.md) for web vs iOS feature parity.**

## Getting Started

```bash
cd mobile-app
pnpm install

# Copy .env.example to .env and fill in values
cp .env.example .env

# Start Expo dev server
pnpm start

# Run on iOS simulator
pnpm ios
```

## Architecture

- **Expo** with `expo-share-extension` for iOS Share Extension
- **Clerk** (`@clerk/expo`) for auth, shared Keychain token cache
- **Neon** (via `https://tote.tools` REST API) for authoritative data — same v2 API endpoints the web app uses
- **SQLite** (`expo-sqlite`) for local device cache — collections and nodes persisted for offline reads

Jazz has been removed. All data flows through the Neon-backed API with a local SQLite cache layer.

## Key Files

- `App.tsx` — Main app (sign-in + collection list)
- `index.share.tsx` — Share Extension (shows confirmation after Swift bridge saves URL)
- `src/providers.tsx` — Clerk provider only (no Jazz)
- `src/tokenCache.ts` — Shared Keychain token cache (App Group `group.tools.tote.app`)
- `src/config.ts` — Environment config (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_APP_URL`)
- `src/lib/api.ts` — All v2 API calls (typed, Bearer token auth via Clerk)
- `src/lib/localDb.ts` — SQLite schema and cache functions (`collections`, `collection_nodes` tables)
- `metro.config.js` — Metro resolver with share extension config

## Data Layer

### API (`src/lib/api.ts`)

All API calls use `await getToken()` from `useAuth()` as a Bearer token:

```ts
import { fetchCollections, fetchCollectionDetail, createCollection,
         updateCollection, deleteCollection, createNode, updateNode,
         deleteNode, reorderNodes, captureUrl,
         getPublicationStatus, publishCollection, unpublishCollection,
         createInvite, acceptInvite } from '../lib/api';
```

Key types:
- `Collection` — `{ id, name, color, description, itemCount, positionKey, role, updatedAt }`
- `CollectionNode` — `{ id, collectionId, parentId, type, title, properties, positionKey, version }`
- `NodeProperties` — `{ url?, imageUrl?, price?, description?, notes?, body?, maxSelections?, budget?, selectedProductIds? }`

Node types: `"section"` (was slot), `"product"`, `"link"`, `"photo"`, `"note"`, `"text"`

### Local Cache (`src/lib/localDb.ts`)

SQLite tables:
- `collections` — mirrors `CollectionSummary` from the API
- `collection_nodes` — mirrors `CollectionNode` from the API

Pattern: load from cache immediately → fetch from API in background → update cache and state.

### Data Mapping (old Jazz → new Neon)

| Jazz | Neon |
|------|------|
| `block.$jazz.id` | `node.id` |
| `block.name` | `node.title` (nodes) / `collection.name` |
| `block.type === "slot"` | `node.type === "section"` |
| `block.productData?.url` | `node.properties.url` |
| `block.productData?.imageUrl` | `node.properties.imageUrl` |
| `block.productData?.price` | `node.properties.price` |
| `block.productData?.notes` | `node.properties.notes` |
| `block.slotData?.maxSelections` | `node.properties.maxSelections` |
| `block.slotData?.budget` | `node.properties.budget` |
| `block.slotData?.selectedProductIds` | `node.properties.selectedProductIds` |
| `block.collectionData?.color` | `collection.color` |
| `block.children` (slot children) | `nodes.filter(n => n.parentId === slot.id)` |

## Share Extension

The share extension (`index.share.tsx`) runs in a separate iOS process. It:
1. Swift bridge (`ToteShareExtension`) intercepts the share sheet, writes URL to App Group UserDefaults, launches main app
2. `index.share.tsx` shows a brief "Added to Tote" confirmation
3. Main app reads pending URLs via `usePendingUrl()` and presents `SaveProductSheet`
4. `SaveProductSheet` extracts metadata via hidden WebView and saves via `POST /api/v2/capture`

Auth is shared via Keychain access group `group.tools.tote.app`.

## Invite Links

Invite links use the format: `https://tote.tools/invite/{token}`

The token is an opaque string returned by `POST /api/v2/collections/{id}/team`.
Accepting uses `POST /api/v2/collection-invites/accept` with `{ token }`.

`useInviteLink` parses the token from the URL path and passes it to `AcceptInviteSheet`.

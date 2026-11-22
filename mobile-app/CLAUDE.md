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

## Native iOS Files — Edit `ios-overrides/`, Never `ios/`

`expo-share-extension` is a config plugin that **generates** the `ToteShareExtension`
target during `expo prebuild` (which `expo run:ios` runs). Prebuild overwrites
hand-written native files, so the canonical copies live in `ios-overrides/` and are
copied into `ios/` by `pnpm ios:sync-overrides`.

**Rule: make every native change in `ios-overrides/`, then run `pnpm ios:sync-overrides`.**
Editing `ios/` directly means your change is reverted the next time anything syncs.

Both trees are committed, so a native change should show up **twice** in `git status`.
If it only appears once, something is out of sync.

- `pnpm ios` — syncs automatically before building
- `pnpm ios:check-overrides` — reports drift, exits non-zero
- **Xcode does not run pnpm scripts.** A `[Tote] Check iOS overrides in sync` build
  phase (first phase on both targets) runs the check and fails the build on drift, so
  an Xcode build or App Store archive can't ship a stale `ios/` copy. It resolves node
  via `ios/.xcode.env{,.local}`.

Caveat: the build phase lives in `ios/Tote.xcodeproj/project.pbxproj`, which prebuild
also regenerates. After a prebuild, re-add it (or restore the pbxproj from git).

### After any `expo prebuild`

Prebuild rewrites the pbxproj and Podfile and silently drops hand-made settings.
Check `git diff` for all of these and restore them:

- The `[Tote] Check iOS overrides in sync` phase on both targets (above).
- `DEVELOPMENT_TEAM` on both targets, every configuration.
- `PrivacyInfo.xcprivacy` in the Tote target's Resources phase.
- `IPHONEOS_DEPLOYMENT_TARGET = 17.0` on `ToteShareExtension` (the plugin writes
  15.1; ClerkExpo needs 17).
- `MARKETING_VERSION` / `CURRENT_PROJECT_VERSION` on `ToteShareExtension` — the plugin
  resets them to 1.0 / 1. Keep them equal to the app's, or App Store Connect warns.
- The three hand-written `post_install` hooks in `ios/Podfile`: no script sandboxing;
  raise pod deployment targets below iOS 15, which Xcode 27 rejects; and put
  expo-sqlite's own directory on its header search path (otherwise it compiles
  against the SDK's `sqlite3.h` and fails with "cannot find 'exsqlite3_…' in scope").

If `exsqlite3_…` errors appear after a `pnpm install`, run `pod install` again:
expo-sqlite copies `sqlite3.c`/`.h` into its package during `pod install`, and pnpm
deletes them whenever it re-links the package.

`index.share.js` exists only because expo-share-extension hardcodes that filename as
the Release bundle entry; it forwards to `index.share.tsx`. Don't delete it — Debug
builds still work without it, so its absence only shows up when archiving.

### Xcode 27 / UIScene

The iOS 27 SDK refuses to launch apps without the UIScene lifecycle. Expo SDK 58
provides it: `ios/Tote/SceneDelegate.swift` subclasses `ExpoAppSceneDelegate`, which
also forwards `tote://` URLs and universal links to `Linking`, and
`ios-overrides/Tote/Info.plist` declares `UIApplicationSceneManifest`. Don't add
window setup or `openURL` handling back to `AppDelegate.swift` — under scenes UIKit
never calls it.

## Key Files

- `App.tsx` — Main app (sign-in + collection list)
- `index.share.tsx` — Share Extension (shows confirmation after Swift bridge saves URL)
- `src/providers.tsx` — Clerk provider only (no Jazz)
- `src/tokenCache.ts` — Shared Keychain token cache (App Group `group.tools.tote.app`)
- `src/config.ts` — Environment config (`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_APP_URL`)
- `src/lib/layout.ts` — Adaptive layout hooks (see [Layout](#layout) below)
- `src/lib/api.ts` — All v2 API calls (typed, Bearer token auth via Clerk)
- `src/lib/localDb.ts` — SQLite schema and cache functions (`collections`, `collection_nodes` tables)
- `metro.config.js` — Metro resolver with share extension config

## Data Layer

### API (`src/lib/api.ts`)

All API calls use `await getToken()` from `useAuth()` as a Bearer token:

```ts
import {
  fetchCollections,
  fetchCollectionDetail,
  createCollection,
  updateCollection,
  deleteCollection,
  createNode,
  updateNode,
  deleteNode,
  reorderNodes,
  captureUrl,
  getPublicationStatus,
  publishCollection,
  unpublishCollection,
  createInvite,
  acceptInvite,
} from '../lib/api';
```

Key types:

- `Collection` — `{ id, name, color, description, itemCount, positionKey, role, updatedAt }`
- `CollectionNode` — `{ id, collectionId, parentId, type, title, properties, positionKey, version }`
- `NodeProperties` — `{ url?, imageUrl?, price?, description?, notes?, body?, maxSelections?, budget?, selectedItemIds? }`

`updateNode` / `reorderNodes` bump the node's `version` server-side. Call sites
must record the new version in local state (`applyNodeVersion` /
`bumpNodeVersions` in `CollectionDetailScreen`) or the next optimistic mutation
sends a stale `expectedVersion` and 409s.

Node types: `"section"` (was slot), `"product"`, `"link"`, `"photo"`, `"note"`, `"text"`

### Local Cache (`src/lib/localDb.ts`)

SQLite tables:

- `collections` — mirrors `CollectionSummary` from the API
- `collection_nodes` — mirrors `CollectionNode` from the API

Pattern: load from cache immediately → fetch from API in background → update cache and state.

### Data Mapping (old Jazz → new Neon)

| Jazz                                 | Neon                                                                                                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `block.$jazz.id`                     | `node.id`                                                                                                                                                |
| `block.name`                         | `node.title` (nodes) / `collection.name`                                                                                                                 |
| `block.type === "slot"`              | `node.type === "section"`                                                                                                                                |
| `block.productData?.url`             | `node.properties.url`                                                                                                                                    |
| `block.productData?.imageUrl`        | `node.properties.imageUrl`                                                                                                                               |
| `block.productData?.price`           | `node.properties.price`                                                                                                                                  |
| `block.productData?.notes`           | `node.properties.notes`                                                                                                                                  |
| `block.slotData?.maxSelections`      | `node.properties.maxSelections`                                                                                                                          |
| `block.slotData?.budget`             | `node.properties.budget`                                                                                                                                 |
| `block.slotData?.selectedProductIds` | `node.properties.selectedItemIds` (legacy rows may still carry `selectedProductIds`; read both, write `selectedItemIds` — the web app uses the same key) |
| `block.collectionData?.color`        | `collection.color`                                                                                                                                       |
| `block.children` (slot children)     | `nodes.filter(n => n.parentId === slot.id)`                                                                                                              |

## Layout

The app runs on iPad (`supportsTablet: true`) and iPhone Duo, so **never hardcode a
column count or read `Dimensions.get('window')` at render time** — the latter doesn't
update on rotation, Split View resize, or folding/unfolding a Duo.

iPhone Duo: folded it's an ordinary 466pt-wide phone; open it's 669 × 951pt and
**ignores `UISupportedInterfaceOrientations`**, so the app runs there sideways too
(even though iPhone is otherwise portrait-only). Fold/unfold is just a window-size
change; the layout hooks handle it with no Duo-specific code. Things to keep in mind:

- The folded screen has a camera + status-bar rail down its right edge (seen in the
  simulator), so `insets.right` is large and `insets.left` is 0. The layout hooks
  therefore return **separate** `paddingLeft`/`paddingRight` that center content
  inside the safe area — never pad both sides by the larger inset (that wastes the
  same width again on the left). Anything absolutely positioned against a side edge
  must add `useSafeAreaInsets().left/right` itself (see `floatingTopBar` and
  `reorderModeBody` in `CollectionDetailScreen`).
- `isRegular` (width ≥ 660pt) stands in for the regular horizontal size class: the
  open Duo is regular in both poses, the folded Duo and every iPhone are compact.
  Apple's Duo guidance is to design for those two classes, not per pose.
- Test in the `iPhone Duo` simulator (iOS 27.1+). Folding and unfolding has to be
  done in Simulator.app; `simctl` has no command for it. In `simctl io`,
  `--display=primary` is the folded screen and `primary-1` the open one.

Use `src/lib/layout.ts`:

- `useGridLayout(idealTileWidth)` → `{ columns, columnWidth, gap, padding, contentWidth, width, isRegular }`.
  Column count is derived from how many `idealTileWidth`-ish tiles fit, the way Photos,
  Pinterest and SwiftUI's `LazyVGrid(.adaptive(minimum:))` do it. Tiles stay the same
  physical size on every device; the grid gains columns instead of stretching them.
  Spread `padding` (`{ paddingLeft, paddingRight }`) into the container style; it pads
  and centers within the safe area, capping grids at 1100pt.
- `useReadablePadding(maxWidth?)` → `{ paddingLeft, paddingRight }` centering a single
  column of rows/forms (default 720pt).
- `useBreakpoints()` — raw `{ width, safeLeft, safeRight, safeWidth, isRegular, gutter, gap }`
  if you need the primitives.

For full-width sheets and forms, the cheap fix is `width: '100%'` + `maxWidth` +
`alignSelf: 'center'` in the stylesheet — a no-op on phones, since the caps never bind
below ~480pt.

`MasonryGrid` is a **true masonry grid**: it assigns each card to whichever column is
currently shortest, so columns stay level. It needs an `estimateHeight(item, width)`
prop to do that, and estimators must be kept roughly in sync with their card's styles
(they only choose a column, so being a little off just makes the bottom edge less even).

Because masonry needs heights up front, image aspect ratios are resolved _before_
layout by `useImageRatios` (`src/hooks/useImageRatios.ts`) and read with `getImageRatio` —
don't measure images inside a card that lives in the grid.

It's a `ScrollView`, not a `FlatList` (FlatList lays out fixed rows, which is what caused
the ragged gaps this replaced), so **every card mounts up front**. Fine for curated
collections; if collections grow into the thousands, add windowing using the offsets the
layout already computes.

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

# Mobile App Roadmap

See [MOBILE_FEATURE_PARITY.md](./MOBILE_FEATURE_PARITY.md) for the full feature comparison between web and iOS.

## Launch status

The only outstanding item for App Store submission is **testing on a real
device via TestFlight** — see [MOBILE_LAUNCH_PLAN.md](./MOBILE_LAUNCH_PLAN.md).
Everything else on that checklist is done and verified: bundle id
`tools.tote.app`, version 1.1.5 (build 4), Universal Links live, and all App
Store Connect metadata.

## Up Next

### 1. Reorder collections

_Low effort_

Products and slots already reorder via drag-and-drop on the collection detail
screen (`react-native-reanimated-dnd`). The collections home list — rendered
inline in `App.tsx` via `MasonryGrid` — has no drag affordance yet. This is the
last remaining parity gap that applies to mobile.

No new API is needed: collection ordering is a `positionKey` on the collection
row, so `PATCH /api/v2/collections/:id` already accepts it. The work is the
drag UI plus persisting the new keys.

## Later

### Sync state indicator for background saves

When a link is saved via the share extension, the capture happens silently. A subtle persistent indicator (e.g. a status bar hint or collection list badge) tied to the existing `useSyncStatus` hook would let users know a save is in flight or recently completed — without a transient toast that disappears before they see it.

### Structured data & cache management library

The current approach hand-rolls stale-while-revalidate with SQLite + `useState`. Consider adopting a library (TanStack Query, SWR, or a React Native-specific alternative — evaluate options when the time comes) to handle cache invalidation, background refresh, deduplication, and loading/error states consistently across screens. SQLite would still be needed as a persistence layer for offline/cold-start reads; the library would sit on top.

### Responsive iPad layouts

_Moderate effort: 1–2 days for core polish; 3–5 days for a full tablet pass_

The app supports iPad technically, but most screens currently stretch the phone
layout across the full window.

- Add a shared responsive layout hook using live window dimensions
- Center primary content with sensible maximum widths
- Increase grid column counts at tablet breakpoints
- Support iPad split view and window resizing
- Cap sheet/modal widths instead of using full-width phone proportions
- Audit collection home, collection detail, save/share sheets, auth, and account settings
- Evaluate landscape and tablet-specific navigation as a follow-up

## Shipped

- Collection list
- Collection detail (products with image, title, price)
- Swipe-to-delete product
- Share extension → save via Safari share sheet
- Save product sheet with metadata extraction + collection/slot picker
- Collection sharing and membership roles (matches the web app model)
- Reorder products and slots (drag-and-drop on collection detail)
- Universal Links for the invite flow (`applinks:tote.tools`, Team ID `8RCZXVFHYN`)
- Save product manually (+ button on collection detail → URL input → SaveProductSheet)
- Product selection (tap checkbox) + slot progress (count / budget)
- Edit slot (gear icon → bottom sheet with name, max selections, budget)
- Edit product name + price
- Refresh product metadata (swipe-left action, re-extracts via WebView)
- Share collection (public URL via publish/unpublish flow)
- Custom short link (inline slug editor in ShareCollectionSheet)
- Accept invite to shared collection (deep link parsing)
- Grid / list view toggle (persisted to AsyncStorage)
- Edit collection name + color
- Delete collection (detail screen action menu)
- Delete slot (from slot settings)
- Account settings (edit name, username)

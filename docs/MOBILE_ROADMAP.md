# Mobile App Roadmap

See [MOBILE_FEATURE_PARITY.md](./MOBILE_FEATURE_PARITY.md) for the full feature comparison between web and iOS.

## Up Next

### 1. Reorder items/slots/collections

_High effort_

- Add drag-and-drop affordances for collections, slots, and products
- Persist ordering in Jazz so mobile and web stay in sync
- Parity item: **Reorder collections / slots / products**

## Pending deployment steps

- **Universal Links (invite flow):** Team ID set to `8RCZXVFHYN`. Deploy the web app and run `pnpm ios` to rebuild with the `associatedDomains` entitlement. Until then, `tote://invite/...` (custom scheme) links work but `https://tote.tools/invite/...` links open in Safari.

## Later

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
- Jazz group ownership (matches web app sharing model)
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

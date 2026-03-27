# Mobile App Roadmap

See [MOBILE_FEATURE_PARITY.md](./MOBILE_FEATURE_PARITY.md) for the full feature comparison between web and iOS.

## Up Next

### 1. Reorder items/slots/collections
*High effort*

- Add drag-and-drop affordances for collections, slots, and products
- Persist ordering in Jazz so mobile and web stay in sync
- Parity item: **Reorder collections / slots / products**

## Pending deployment steps

- **Universal Links (invite flow):** Replace `XXXXXXXXXX` in `src/app/.well-known/apple-app-site-association/route.ts` with the Apple Developer Team ID (found at developer.apple.com → Account → Membership), then deploy the web app and run `pnpm ios` to rebuild with the `associatedDomains` entitlement. Until then, `tote://invite/...` (custom scheme) links work but `https://tote.tools/invite/...` links open in Safari.

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
- Delete collection (swipe on list)
- Delete slot (from slot settings)
- Account settings (edit name, username)

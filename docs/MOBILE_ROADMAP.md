# Mobile App Roadmap

See [MOBILE_FEATURE_PARITY.md](./MOBILE_FEATURE_PARITY.md) for the full feature comparison between web and iOS.

## Up Next

### 1. Edit product name / price
*Medium effort*

- Long-press a product row to edit name and price inline
- Useful when the extractor gets metadata wrong or price changes
- Parity item: **Edit product (name, price, notes)**

## Later

- Refresh product metadata (re-run extraction on demand)
- Slot budget + max selections UI (set limits, not just view them)
- Edit / delete slots and collections
- Share collection (public URL)

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

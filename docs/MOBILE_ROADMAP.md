# Mobile App Roadmap

See [MOBILE_FEATURE_PARITY.md](./MOBILE_FEATURE_PARITY.md) for the full feature comparison between web and iOS.

## Up Next

### 1. Product selection + slot progress
*Quick win — logic already exists in web app's `slotHelpers.ts`*

- Tap a product row in a slot to toggle it as selected (checkmark indicator)
- Slot section header shows progress: "2 / 3 selected" or "$189 / $300 budget"
- Parity items: **Mark product as selected**, **View selected count vs max**, **View selected total vs budget**

### 2. Save product manually
*Quick win — feeds into existing `SaveProductSheet`*

- "+" button on the collection detail screen opens a URL input
- Same extraction + collection picker flow as the share extension
- Parity item: **Save product manually (paste URL)**

### 3. Edit product name / price
*Medium effort*

- Long-press a product row to edit name and price inline
- Useful when the extractor gets metadata wrong or price changes
- Parity item: **Edit product (name, price, notes)**

## Later

- Refresh product metadata (re-run extraction on demand)
- Slot budget + max selections UI (set limits, not just view them)
- Edit / delete slots and collections
- Share collection (public URL)

## Shipped

- Collection list
- Collection detail (products with image, title, price)
- Swipe-to-delete product
- Share extension → save via Safari share sheet
- Save product sheet with metadata extraction + collection/slot picker
- Jazz group ownership (matches web app sharing model)

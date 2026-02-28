# Price History Tracking

## Context

Tote currently overwrites product prices on each metadata refresh with no record of previous values. Users have no way to see if a product's price has gone up or down over time. This feature adds price history tracking — recording snapshots on each refresh, surfacing changes visually, and providing a chart to see trends.

## Design Decisions

- **Record every refresh** with no cap. Entries where the price changed from the previous entry get a `changed: true` flag for visual highlighting.
- **Sparkline on ProductCard** — small inline SVG showing price trend at a glance.
- **Dedicated modal** — click the sparkline to open a full price history view with a larger chart and entry list.
- **Hand-rolled SVG** — no charting library. Keeps bundle size minimal (core project value).
- **Currency stored** — `currency` field added to `ProductData` since extractors already return it but it's currently discarded.

---

## Step 1: Schema Changes

**File: `src/schema.ts`**

Add new Jazz CoValue types:

```typescript
export const PriceHistoryEntry = co.map({
  priceValue: z.number(),          // e.g. 29.99
  price: z.string(),               // display string e.g. "29.99"
  currency: z.string(),            // ISO 4217 e.g. "USD"
  recordedAt: z.date(),
  source: z.enum(["extraction", "manual", "initial"]),
  changed: z.boolean(),            // true if price differs from previous entry
});

export const PriceHistoryList = co.list(PriceHistoryEntry);
```

Add to `Block`:
```typescript
get priceHistory() {
  return PriceHistoryList.optional();
}
```

Add `currency` to `ProductData`:
```typescript
currency: z.string().optional(),
```

---

## Step 2: Price History Utility

**New file: `src/lib/priceHistory.ts`**

Core functions:

- **`recordPriceSnapshot(block, snapshot)`** — Appends a `PriceHistoryEntry` to the block's `priceHistory` list. Creates the list if it doesn't exist. Sets `changed: true` if price differs from the last entry.

- **`getPriceChange(priceHistory)`** — Returns `{ direction: "up" | "down" | "none", previousPrice, currentPrice, percentChange }` by comparing the last two entries with differing prices. Returns `null` if insufficient history.

---

## Step 3: Hook Into Refresh Flow

**File: `src/components/CollectionView/CollectionView.tsx`**

In `refreshBlockMetadata` (line ~114-156):
1. Add `currency` to the local `ExtractedMetadata` interface (line 36-41)
2. After extracting metadata, call `recordPriceSnapshot()` before updating `productData`
3. Store `currency` and `priceValue` (parsed from price string) in `productData`

---

## Step 4: Hook Into Initial Save Flows

**File: `src/components/AddLinkDialog/AddLinkDialog.tsx`** (line ~92-105)
- After creating the product block, if a price was extracted, create a `PriceHistoryList` with one initial entry (`source: "initial"`)
- Store `currency` in `productData`

**File: `chrome-extension/src/popup/popup.tsx`** (save handler)
- Same pattern: create initial price history entry on save if price exists
- Note: extension imports schema from shared location

---

## Step 5: Hook Into Manual Price Edits

**File: `src/components/EditLinkDialog/EditLinkDialog.tsx`** (line ~146-151)
- On save, if price changed from current `productData.price`, call `recordPriceSnapshot()` with `source: "manual"`

---

## Step 6: PriceSparkline Component

**New files:**
- `src/components/PriceSparkline/PriceSparkline.tsx`
- `src/components/PriceSparkline/PriceSparkline.module.css`

Props: `entries: PriceHistoryEntry[], width?, height?, onClick?`

Implementation:
- SVG `<polyline>` for the line, `<polygon>` for subtle fill beneath
- Normalize Y values (min-max scaling), spread X evenly
- Color based on overall trend: green (price dropped), red (increased), gray (unchanged)
- Dot on the last data point
- Change points highlighted with slightly larger dots
- Clickable — `onClick` opens the detail modal
- Uses CSS variables from design system (`--color-success`, `--color-danger`)
- Renders nothing if < 2 entries

---

## Step 7: PriceHistoryModal Component

**New files:**
- `src/components/PriceHistoryModal/PriceHistoryModal.tsx`
- `src/components/PriceHistoryModal/PriceHistoryModal.module.css`

Contents:
- Larger SVG chart (~400×200) with date labels on X axis and price labels on Y axis
- Dots at each data point; change-points highlighted (green/red)
- Hover/tap on dots shows tooltip with exact price + date
- Below the chart: scrollable list of entries showing date, price, direction arrow, and % change (for entries where `changed: true`)
- Uses Radix `Dialog` (already a dependency) for the modal shell

---

## Step 8: Integrate Into ProductCard

**File: `src/components/ProductCard/ProductCard.tsx`**

- Where the `.priceTag` is rendered (lines 101-104, 122-124):
  - Add a small change indicator arrow next to price text (▲ red / ▼ green) when `getPriceChange()` returns a direction
  - Below the price tag, render `<PriceSparkline>` if the block has 2+ history entries
  - Clicking the sparkline opens `<PriceHistoryModal>`

---

## Step 9: Update TableView Price Column

**File: `src/components/CollectionView/columns.tsx`**

- Add directional arrow indicator (▲/▼) inline with price text
- Optional: make price cell clickable to open the history modal

---

## Step 10: Update Resolve Depths

Wherever blocks are loaded with `useCoState` or resolve options, add `priceHistory` loading:

```typescript
priceHistory: { $each: {} }
```

Key locations to check:
- `src/app/collections/[id]/page.tsx`
- `src/app/page.tsx`
- Any shared/published collection loaders

**Do NOT clone price history for published collections** — it's private user data. Published views show current price only.

---

## Files Modified (summary)

| File | Change |
|------|--------|
| `src/schema.ts` | Add PriceHistoryEntry, PriceHistoryList, currency field, priceHistory on Block |
| `src/lib/priceHistory.ts` | **New** — recordPriceSnapshot, getPriceChange, shouldRecord |
| `src/components/PriceSparkline/*` | **New** — SVG sparkline component |
| `src/components/PriceHistoryModal/*` | **New** — full history modal with chart + list |
| `src/components/CollectionView/CollectionView.tsx` | Add currency to ExtractedMetadata, call recordPriceSnapshot in refresh |
| `src/components/AddLinkDialog/AddLinkDialog.tsx` | Record initial price snapshot on save |
| `src/components/EditLinkDialog/EditLinkDialog.tsx` | Record manual price snapshot on edit |
| `src/components/ProductCard/ProductCard.tsx` | Add change indicator + sparkline + modal trigger |
| `src/components/CollectionView/columns.tsx` | Add change indicator to table price column |
| `chrome-extension/src/popup/popup.tsx` | Record initial price snapshot on extension save |

---

## Verification

1. **Schema**: `pnpm build` compiles without errors
2. **Initial save**: Add a link with a price → verify priceHistory has 1 entry with `source: "initial"`
3. **Refresh**: Refresh a link → verify new entry appended
4. **Change detection**: Manually edit a price in EditLinkDialog → verify `changed: true` on the new entry, arrow indicator appears on card
5. **Sparkline**: With 2+ history entries, sparkline renders on ProductCard
6. **Modal**: Click sparkline → modal opens with full chart and entry list
7. **Extension**: Save via extension → verify initial price history entry created
8. **Published collections**: Verify price history is NOT included in published/shared snapshots

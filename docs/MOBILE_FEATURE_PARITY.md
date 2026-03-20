# Mobile Feature Parity

Tracks which web app features exist on iOS. Updated as mobile catches up.

## Prioritization Matrix

Ranking missing features by **impact** (does it unblock real user workflows?) and **effort** (implementation complexity on mobile).

|  | Low Effort | High Effort |
|---|---|---|
| **High Impact** | Delete product • Mark product as selected • View selected count + budget total • Save product manually (paste URL) | Refresh product metadata • Slot budget + max selections UI |
| **Low Impact** | Edit collection name/color • Edit/delete slot • Delete collection • View selected total vs budget (display only) | Reorder items/slots/collections • Grid view mode • Share collection • Accept collection invite |

**Quick wins** (high impact, low effort — do these next):
1. **Delete product** — swipe-to-delete, single Jazz field update
2. **Mark product as selected** — tap to toggle `selectedProductIds` on the slot, logic already exists in `slotHelpers.ts`
3. **View selected count + budget total** — read-only display in slot header, all data already loaded
4. **Save product manually** — text input that feeds into the existing `SaveProductSheet`

---

## Collections

| Feature | Web | iOS |
|---|---|---|
| List all collections | ✅ | ✅ |
| Create collection | ✅ | ✅ (via save sheet) |
| Edit collection name/color | ✅ | ❌ |
| Delete collection | ✅ | ❌ |
| View collection detail | ✅ | ✅ |
| Grid / list view modes | ✅ | ❌ (list only) |
| Reorder collections | ✅ | ❌ |

## Products

| Feature | Web | iOS |
|---|---|---|
| Save product via extension | ✅ (Chrome) | ✅ (Share sheet) |
| Save product manually (paste URL) | ✅ | ❌ |
| View product (image, title, price) | ✅ | ✅ |
| Open product URL | ✅ | ✅ |
| Refresh product metadata | ✅ | ❌ |
| Edit product (name, price, notes) | ✅ | ❌ |
| Delete product | ✅ | ✅ |
| Reorder products | ✅ | ❌ |

## Slots

| Feature | Web | iOS |
|---|---|---|
| View products grouped by slot | ✅ | ✅ |
| Ungrouped section | ✅ | ✅ |
| Create slot | ✅ | ✅ (via save sheet) |
| Edit slot name | ✅ | ✅ |
| Delete slot | ✅ | ❌ |
| Reorder slots | ✅ | ❌ |
| Slot budget (set limit, track total) | ✅ | ❌ |
| Slot max selections | ✅ | ❌ |
| Mark product as selected | ✅ | ✅ |
| View selected count vs max | ✅ | ✅ |
| View selected total vs budget | ✅ | ✅ |

## Sharing

| Feature | Web | iOS |
|---|---|---|
| Share collection (public URL) | ✅ | ❌ |
| Custom short link | ✅ | ❌ |
| Accept invite to shared collection | ✅ | ❌ |

## Auth & Account

| Feature | Web | iOS |
|---|---|---|
| Sign in (Google) | ✅ | ✅ |
| Sign in (Apple) | ✅ | ✅ |
| Sign out | ✅ | ✅ |
| Account settings | ✅ | ❌ |

## Other

| Feature | Web | iOS |
|---|---|---|
| Offline support | ✅ (Jazz) | ✅ (Jazz) |
| Real-time sync across devices | ✅ | ✅ |
| Save open tabs (Chrome) | ✅ | ❌ |

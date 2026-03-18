# Tote React Native iOS App — Plan

## Core Idea

An Expo-based iOS app whose primary job is the Share Extension — tap "Share" in Safari, pick Tote, save. Same Jazz data layer + Clerk auth as the web app, so everything syncs automatically.

## Status

Phases 1–2 complete. The app builds, runs on simulator, authenticates via Google/Apple OAuth, and displays Jazz-synced collections.

**Current share extension behaviour:** user shares a URL → extension saves it to `Settings` (NSUserDefaults) → auto-closes with "Open Tote to add to a collection." The main app does not yet handle the pending URL.

**Next up:** Phase 3 — pending URL handling + save product flow in the main app.

---

## Key Architecture Decisions

### Share extension stays dumb
Jazz and Clerk are too heavy for the iOS share extension process (~120 MB memory limit). Attempting to initialise them in the extension caused crashes.

**Decision:** the share extension only saves the URL to `Settings` and closes. All Jazz writes happen in the main app.

> Jazz full docs: https://jazz.tools/llms-full.txt

### Schema sharing
`src/schema.ts` is imported directly into the mobile app via TypeScript path alias + Metro resolver config (`@tote/schema`). Same pattern the Chrome extension uses.

### Metadata extraction via hidden WebView
Unlike the Chrome extension (which runs `extractMetadata()` against a live DOM), the mobile app only gets a URL. We use a hidden `react-native-webview` inside `SaveProductSheet` to load the product page, then inject the extraction script once the page is fully rendered. This gives us the full DOM — JS-rendered prices, Shopify variant selection, everything the Chrome extension sees.

Flow:
1. `WebView` loads the URL (hidden, not visible to user)
2. `onLoadEnd` fires — page is fully rendered including JS
3. Inject `extractMetadata()` script via `injectJavaScript()`
4. Script calls `window.ReactNativeWebView.postMessage(JSON.stringify(result))`
5. `onMessage` receives the result and updates state

The extraction script is a self-contained IIFE adapted from `chrome-extension/src/lib/extractors/index.ts` — same logic, no changes needed.

---

## Implementation Phases

### ✅ Phase 1 — Scaffold
`create-expo-app`, pnpm workspace, Jazz/Clerk/share-extension deps, Metro config + schema alias.

### ✅ Phase 2 — Main app auth + collection list
`ClerkProvider` + `JazzExpoProvider`, shared keychain token cache, Google/Apple OAuth sign-in, collection list screen.

### 🔲 Phase 3 — Pending URL → Save Product flow

The main app handles the URL that the share extension stashed.

**New files:**

```
mobile-app/src/
  hooks/
    usePendingUrl.ts          # Reads/clears Settings pending URL + AppState listener
  lib/
    extractorScript.ts        # IIFE string — injected into WebView, adapted from chrome extractor
  components/
    SaveProductSheet.tsx      # Full save flow sheet
    ProductSkeleton.tsx       # Animated skeleton shown during WebView extraction
    CollectionPicker.tsx      # Collection + slot list, new collection option
```

**`usePendingUrl`** — checks `Settings` for `tote_pending_shared_url` on mount and on every `AppState` change to `active`. Returns `{ pendingUrl, clearPendingUrl }`.

**`extractorScript.ts`** — exports a string containing the extraction logic as an IIFE. Adapted directly from `chrome-extension/src/lib/extractors/index.ts`, with `window.ReactNativeWebView.postMessage(JSON.stringify(result))` at the end instead of returning. Injected via `webview.injectJavaScript()` on `onLoadEnd`.

**`SaveProductSheet`** UI states:
1. **Skeleton** — shown immediately while the hidden WebView loads and extracts. Animated placeholder blocks for image, title, and price — matches the shape of the preview so the transition feels smooth.
2. **Preview** — thumbnail, title, price populated. User picks collection (and optionally slot).
3. **Saving** — brief transition then close

**`ProductSkeleton`** — three shimmer placeholder blocks (image rectangle, title line, price line) using `Animated` API with a looping opacity pulse. No extra dependencies.

**Writing to Jazz:** create a `Block` with `type: "product"`, `name: title`, `productData: { url, imageUrl, price, priceValue, description }` and push it onto `collection.children` (or `slot.children`). Block must be owned by the collection's group so sharing works.

**`App.tsx` changes:** import `usePendingUrl`, render `<SaveProductSheet>` when `pendingUrl` is set.

### 🔲 Phase 4 — Polish
- Real device testing (share from Safari on iPhone)
- Edge cases: no metadata found, network error, not signed in when share triggers
- Slot creation from within the save sheet

---

## What's Out of Scope (for now)

- Editing extracted metadata before save
- Android
- Price tracking / notifications
- Full collection management UI in the app

---

## Key Files

| File | Purpose |
|---|---|
| `mobile-app/App.tsx` | Main app — collection list + auth |
| `mobile-app/index.share.tsx` | Share extension — URL handoff only |
| `mobile-app/src/providers.tsx` | Clerk + Jazz provider setup |
| `mobile-app/src/tokenCache.ts` | Shared Keychain token cache |
| `mobile-app/src/config.ts` | Environment config |
| `mobile-app/metro.config.js` | Metro resolver + `@tote/schema` alias |
| `src/schema.ts` | Shared Jazz schema (Block, Collection, Slot, Product) |
| `chrome-extension/src/lib/extractors/index.ts` | Source for extraction script — port to IIFE |

## UX: Loading Animation

WebView extraction takes 1–4 seconds depending on the page. The user must not see a blank sheet during this time.

**`ProductSkeleton`** renders immediately when the sheet opens — before the WebView has loaded anything. It shows shimmer placeholder blocks matching the shape of the final preview:
- A rounded rectangle for the product image
- A wide line for the title
- A short line for the price

Animation: looping opacity fade (1.0 → 0.4 → 1.0) using React Native's `Animated` API. No third-party animation library needed.

When extraction completes, the sheet transitions from skeleton → populated preview. The layout shape stays the same so there's no jarring shift.

# Tote React Native iOS App — Plan

## Core Idea

An Expo-based iOS app whose primary job is the Share Extension — tap "Share" in Safari, pick a collection, save. Same Jazz data layer + Clerk auth as the web app, so everything syncs.

## Key Architecture Decisions

- **Expo over bare RN** — Jazz officially supports Expo (`jazz-tools/expo`), Clerk ships `@clerk/expo`, and `expo-share-extension` handles the iOS Share Extension target setup.
- **expo-share-extension (not expo-share-intent)** — renders a custom React Native view inside the share sheet itself (like Pinterest's "Save Pin"), so users pick a collection and save without leaving Safari.
- **Schema sharing** — import `src/schema.ts` directly via TypeScript path alias + Metro resolver config. Same pattern the Chrome extension uses.

## The Hard Parts

### 1. Auth in the Share Extension
iOS share extensions run in a separate process. Solution: configure Clerk's `tokenCache` to use a shared Keychain access group (via `expo-secure-store` with `keychainAccessGroup`). Both the main app and extension read the same token. Fallback: "Open Tote to sign in" button.

### 2. Jazz in the Share Extension
Jazz needs `expo-sqlite`, `expo-secure-store`, `expo-file-system` — all must be linked to the extension target too. `expo-share-extension` supports `extraPods` for this. If Jazz init proves too heavy for the extension's ~120MB memory limit, fallback: stash URL + collection ID in App Group UserDefaults, main app saves on next launch.

### 3. Metadata extraction without DOM access
Unlike the Chrome extension, you only get a URL. A simple fetch + OG tag parse gets title/image. Accept lower extraction quality for MVP.

## MVP Scope

| In | Out |
|---|---|
| iOS Share Extension (save URL to collection) | Android |
| Clerk sign-in in main app | Rich metadata extraction |
| Minimal collection list screen | Full collection management UI |
| Jazz sync (offline-first) | Price tracking / notifications |

## Implementation Phases

1. **Scaffold** — `create-expo-app`, add to pnpm workspace, install Jazz/Clerk/share-extension deps, configure Metro + schema alias
2. **Main app auth** — ClerkProvider + JazzExpoProvider, shared keychain token cache, minimal sign-in + collection list screen
3. **Share extension** — ShareView with collection picker + save button, port `handleSave` from Chrome extension's `popup.tsx`
4. **Polish** — OG tag fetching for titles/images, real device testing, edge cases

## Key Files to Port From

- `chrome-extension/src/popup/popup.tsx` → save flow (lines 373-438)
- `chrome-extension/src/hooks/useCollections.ts` → collection loading
- `chrome-extension/src/providers/ExtensionProviders.tsx` → Jazz init pattern for non-web context
- `src/schema.ts` → shared directly

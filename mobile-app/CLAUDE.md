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
- **Jazz** (`jazz-tools/expo`) for local-first data sync — full docs at https://jazz.tools/llms-full.txt
- **Schema** shared from `../src/schema.ts` via Metro alias `@tote/schema`

## Key Files

- `App.tsx` — Main app (sign-in + collection list)
- `index.share.tsx` — Share Extension (collection picker + save)
- `src/providers.tsx` — Clerk + Jazz provider setup
- `src/tokenCache.ts` — Shared Keychain token cache
- `src/config.ts` — Environment config
- `metro.config.js` — Metro resolver with schema alias + share extension

## Share Extension

The share extension (`index.share.tsx`) runs in a separate iOS process. It:
1. Reads the shared URL from `useShareExtensionUrl()`
2. Shows collection picker using same Jazz data
3. Saves a product Block to the selected collection
4. Auto-closes the share sheet

Auth is shared via Keychain access group `group.tools.tote.app`.

## Jazz Mutation Patterns

See [../CLAUDE.md](../CLAUDE.md) for Jazz mutation patterns (`.$jazz.set`, `.$jazz.splice`, etc.).

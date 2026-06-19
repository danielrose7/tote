# Tote - Development Guide

## Product Principles

**Read [PRODUCT.md](./PRODUCT.md) first.** It defines our core values (privacy, speed, bundle size) and guides all technical decisions.

## Tech Stack

- **Neon (Postgres)** - Primary database via Drizzle ORM
- **Clerk** - Authentication
- **Ably** - Realtime push (Postgres outbox → Ably channels → TanStack Query invalidation)
- **TanStack Query** - Server state, `staleTime: 30s`
- **Next.js 16** - App Router, React 19
- **TypeScript** - Strict mode
- **Jazz** - Legacy local-first sync, being migrated out; still present for classic collection import/migration flows

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
  components/    # React components
  db/            # Drizzle schema and migrations
  hooks/         # Custom hooks (useCollectionRealtime, etc.)
  lib/           # Business logic (collections/repository.ts, publishedCollectionsDb.ts, formatPrice.ts, etc.)
chrome-extension/
  src/           # Extension source (popup, content scripts, extractors)
  CLAUDE.md      # Extension-specific dev guide
mobile-app/      # React Native / Expo iOS app
docs/
  PLATFORM_METADATA_PATTERNS.md  # Extraction patterns reference
```

## Key Files

- `src/db/schema.ts` - Drizzle schema (collections, collection_nodes, collection_members, ably_outbox, ably_nodes)
- `src/lib/collections/repository.ts` - All collection read/write operations
- `src/lib/publishedCollectionsDb.ts` - Public collection queries (published/shared)
- `src/lib/formatPrice.ts` - Shared price formatter; use everywhere prices are displayed
- `src/app/providers.tsx` - Clerk + Jazz provider setup (Jazz kept for migration)
- `src/hooks/useCollectionRealtime.ts` - Ably subscription hook
- `chrome-extension/src/lib/extractors/` - Metadata extraction logic

## Realtime Architecture

Mutations write to `ably_outbox` in the same DB transaction. The Ably Postgres connector polls via `pg_notify('ably_adbc')` and publishes to channels. Clients subscribe via `useCollectionRealtime` and call `queryClient.invalidateQueries` on message.

- `user:<id>:collections` — collection list changes
- `collection:<id>` — individual collection changes

The Ably connector **must** use `NEON_DB_DATABASE_URL_UNPOOLED` — PgBouncer doesn't support `LISTEN/NOTIFY`.

Token auth: clients fetch scoped subscribe-only tokens from `/api/v2/realtime/token` using `ABLY_ROOT_KEY` (server-only, never `NEXT_PUBLIC_*`).

## Extraction Logic — Keep Two Files in Sync

The extraction logic lives in two places and **must stay in sync**:

1. `chrome-extension/src/lib/extractors/index.ts` — TypeScript, runs as a content script in the browser
2. `mobile-app/src/lib/extractorScript.ts` — Hand-ported ES5, injected into a WebView via `injectJavaScript()`

**Rule: any fix or improvement to extraction logic in one file must be applied to the other.**

The mobile script is a template literal (backtick string), so regex backslashes need double-escaping (`\\d` instead of `\d`). Logic, helper names, and comments should otherwise match as closely as possible.

## Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build

# Chrome extension
cd chrome-extension
pnpm dev          # Build with watch
pnpm test         # Run extraction tests
pnpm build        # Production build
pnpm build:zip    # Build + zip for Chrome Web Store submission
```

## Curator Dev UI

The dev-only collection curator lives at `/dev/curate`.

- Workflow background: [docs/CURATOR_WORKFLOW.md](./docs/CURATOR_WORKFLOW.md)
- Prompt patterns & best practices: [docs/PROMPT_PATTERNS.md](./docs/PROMPT_PATTERNS.md)
- Inngest Realtime React hooks reference: [https://www.inngest.com/docs-markdown/features/realtime/react-hooks](https://www.inngest.com/docs-markdown/features/realtime/react-hooks)

## Guidelines

1. **Privacy first** - No analytics, tracking, or data collection
2. **Bundle size matters** - Avoid adding dependencies; justify new ones
3. **Keep it simple** - Prefer boring solutions over clever ones

## Route Groups

- `(app)/` — authenticated routes; layout wraps in `Providers` (ClerkProvider + Jazz)
- `(public)/` — public routes; layout wraps in ClerkProvider only
- Root layout is bare (html/body only, no providers)

## Jazz Migration Notes

Jazz is being phased out in favor of Neon. New features go to Neon. The Jazz schema (`src/schema.ts`) and `JazzReactProviderWithClerk` are kept only to support:

- Classic collection import/migration UI
- Shared collection handoff flows

Do not add new Jazz CoValues or mutations. Use `src/lib/collections/repository.ts` and `/api/v2/` routes instead.

## UI Conventions

- **Use "Add" not "Create"** — Button labels should say "Add Collection", "Add Link", etc. (not "Create" or "New")
- **Prices** — always use `formatPrice()` from `src/lib/formatPrice.ts`; never format inline
- **Preview images** — cap at 3 per collection card across all surfaces

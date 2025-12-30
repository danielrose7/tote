# Tote - Development Guide

## Product Principles

**Read [PRODUCT.md](./PRODUCT.md) first.** It defines our core values (privacy, speed, bundle size) and guides all technical decisions.

## Tech Stack

- **Jazz** - Local-first database with real-time sync
- **Clerk** - Authentication (integrated with Jazz via `JazzReactProviderWithClerk`)
- **Next.js 16** - App Router, React 19
- **TypeScript** - Strict mode

## Project Structure

```
src/
  app/           # Next.js App Router pages and API routes
  components/    # React components
  hooks/         # Custom hooks
  schema.ts      # Jazz schema (ProductLink, Collection, AccountRoot)
chrome-extension/
  src/           # Extension source (popup, content scripts, extractors)
  CLAUDE.md      # Extension-specific dev guide
docs/
  PLATFORM_METADATA_PATTERNS.md  # Extraction patterns reference
```

## Key Files

- `src/schema.ts` - Jazz data model
- `src/app/providers.tsx` - Clerk + Jazz provider setup
- `chrome-extension/src/lib/extractors/` - Metadata extraction logic

## Commands

```bash
pnpm dev          # Start Next.js dev server
pnpm build        # Production build

# Chrome extension
cd chrome-extension
pnpm dev          # Build with watch
pnpm test         # Run extraction tests
pnpm build        # Production build
```

## Guidelines

1. **Privacy first** - No analytics, tracking, or data collection
2. **Bundle size matters** - Avoid adding dependencies; justify new ones
3. **Offline works** - Jazz handles sync; don't assume network
4. **Keep it simple** - Prefer boring solutions over clever ones

## UI Conventions

- **Use "Add" not "Create"** - Button labels should say "Add Collection", "Add Link", etc. (not "Create" or "New")

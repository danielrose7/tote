# Tote - One place, every store

A snazzy product link collection app built with **[Jazz](https://jazz.tools)** (distributed database), React, Next.js, and TypeScript. Save, organize, and track products you want to remember with rich metadata, visual displays, and collections.

**Live URL:** https://tote.tools

## Tech Stack

- **Jazz** - Distributed database with real-time sync
- **Clerk** - Authentication
- **Next.js** - React framework with App Router
- **TypeScript** - Type safety
- **CSS Modules** - Scoped styling
- **Radix UI** - Accessible component primitives
- **Formik + Yup** - Form validation

## Running locally

Install dependencies:

```bash
npm install
# or
pnpm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Key Features

- ✅ **Chrome Extension** - Save products with one click from any site
- ✅ **Collections** - Organize product links into visual collections
- ✅ **Rich Metadata** - Automatically extract title, description, images, and prices
- ✅ **Product Cards** - Beautiful visual cards with hover animations
- ✅ **Real-time Sync** - Jazz handles cross-device synchronization
- ✅ **Offline Support** - Works offline, syncs when reconnected

## Chrome Extension

The Chrome extension provides the best experience for saving products:

1. Build the extension: `cd chrome-extension && pnpm install && pnpm build`
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top right)
4. Click "Load unpacked" and select `chrome-extension/dist`

See [chrome-extension/CLAUDE.md](./chrome-extension/CLAUDE.md) for development details.

## Questions / problems / feedback

If you have feedback, let us know on [Discord](https://discord.gg/utDMjHYg42) or open an issue or PR to fix something that seems wrong.

## Configuration: sync server

By default, Tote uses [Jazz Cloud](https://jazz.tools/cloud) (`wss://cloud.jazz.tools`) - so cross-device sync works automatically.

You can also run a local sync server with `npx jazz-run sync`, and update the `sync` parameter in [./src/app/providers.tsx](./src/app/providers.tsx) to `{ peer: "ws://localhost:4200" }`.

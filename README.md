# Tote - Product Wishlist App

A snazzy product link collection app built with **[Jazz](https://jazz.tools)** (distributed database), React, Next.js, and TypeScript. Save, organize, and track products you want to remember with rich metadata, visual displays, and collections.

**Live URL:** https://tote.tools

## Tech Stack

- **Jazz** - Distributed database with real-time sync
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

- ✅ **Collections** - Organize product links into visual collections
- ✅ **Rich Metadata** - Automatically extract title, description, images from URLs
- ✅ **Product Cards** - Beautiful visual cards with hover animations
- ✅ **Real-time Sync** - Jazz handles cross-device synchronization
- ✅ **Offline Support** - Works offline, syncs when reconnected
- 🚧 **Improved Metadata Extraction** - Custom extraction for indie e-commerce sites (in progress)

## Project Documentation

→ **[METADATA_DOCS_INDEX.md](./METADATA_DOCS_INDEX.md)** - Complete documentation index

**Key Documents:**
- **[PLAN.md](./PLAN.md)** - Project roadmap and architecture
- **[QUICK_START_TESTING.md](./QUICK_START_TESTING.md)** - Start testing metadata extraction
- **[METADATA_TESTING_SETUP.md](./METADATA_TESTING_SETUP.md)** - Testing infrastructure overview
- **[METADATA_INVESTIGATION.md](./METADATA_INVESTIGATION.md)** - Research plan for metadata improvements

## Development Tools

### Metadata Test Lab (Localhost Only)

When running on localhost, you'll see a **"🧪 Test Lab"** button in the header. This opens the Metadata Test Lab at `/dev/metadata-test`.

**Features:**
- Test product URLs with current metadata extraction
- Document expected vs actual results
- Track issues and severity
- Save test cases to file for version control
- Re-test URLs after making improvements

**Learn more:** [app/dev/metadata-test/README.md](./app/dev/metadata-test/README.md)

## Questions / problems / feedback

If you have feedback, let us know on [Discord](https://discord.gg/utDMjHYg42) or open an issue or PR to fix something that seems wrong.


## Configuration: sync server

By default, the React starter app uses [Jazz Cloud](https://jazz.tools/cloud) (`wss://cloud.jazz.tools`) - so cross-device use, invites and collaboration should just work.

You can also run a local sync server by running `npx jazz-run sync`, and setting the `sync` parameter of `JazzReactProvider` in [./src/app.tsx](./src/app.tsx) to `{ peer: "ws://localhost:4200" }`.

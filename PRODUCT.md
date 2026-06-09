# Tote - Product Principles

## Core Values

### 1. Privacy First
- User data stays with the user (Jazz local-first architecture)
- No tracking, analytics, or data mining
- Sharing is opt-in and explicit, never default

### 2. Speed
- Fast page loads, instant interactions
- No spinners for common operations
- Offline-first: works without network

### 3. Minimal Bundle
- Ship less JavaScript
- Avoid heavy dependencies
- Progressive enhancement over feature bloat

## Priority Order

When making tradeoffs:
1. Privacy
2. Speed
3. Bundle size
4. Features
5. Social/sharing

## Roadmap

### Now
- [x] **Recrawl command** - Update metadata for existing saved links
- [x] **Right-click save** - Context menu "Save to Tote" in extension

### Next
- [x] **Shareable collections** - Public links to collections (opt-in)
- [ ] **Price drop notifications** - Alert when saved items go on sale

### Later
- [ ] Collaborative wishlists
- [ ] Keyboard shortcuts
- [ ] Safari extension (iOS/macOS) - Convert Chrome extension via [safari-web-extension-converter](https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension)

## Projects in Flux

These projects exist behind access controls and are actively being explored. Their
scope, positioning, pricing, and long-term place in Tote are not settled.

### Collection Chat
- Currently gated per user with `chatEnabled`
- Searches for products, suggests alternatives, and adds results to collections
- May evolve toward collection-aware research, comparison, and decision support

### Curator
- Currently gated per user or globally with `CURATOR_ENABLED`
- Builds and refines collections from a brief, constraints, and budget
- Uses paid credits while workflow costs and pricing are still being calibrated
- May remain a distinct workflow or contribute capabilities to chat and other tools

## Potential Future Ideas

These are possible add-ons, not committed roadmap items. Saving, organizing, syncing,
and basic sharing should remain part of Tote's free core. Paid features should do
additional work for the user rather than artificially limiting that core.

### Watch
- Price-drop and back-in-stock alerts
- Used or refurbished listing discovery
- Product-change monitoring
- Price history and "wait or buy?" guidance
- Possible model: subscription or monitored-item packs

### Curator Directions
- Build a collection from a brief, constraints, and budget
- Find alternatives, fill gaps, and compare candidates
- Refresh stale collections
- Possible model: credits per completed workflow

### Decision Tools
- Side-by-side comparison matrices
- Duplicate and near-duplicate detection
- Budget totals and tradeoff summaries
- Private voting or ranked-choice shortlists

### Shared Planning
- Collaborative registries, trips, renovations, gifts, and events
- Assignments, comments, deadlines, and private gift claiming
- Change history and contributor permissions
- Possible model: charge the collection owner rather than every participant

### Publisher Tools
- Custom public collection pages, branding, and domains
- Editorial sections and notes
- Affiliate-link support and link health checks
- Lightweight, privacy-conscious audience statistics

### Reports and Exports
- Polished buying guides generated from a collection
- PDF, email, or presentation exports
- Possible model: one-time purchase per report

### Professional Workspaces
- Reusable templates and client collections
- Approval states, annotations, exports, and archives
- Workflows for designers, stylists, personal shoppers, and event planners

### Capture and Automation
- Email-to-Tote
- Share-sheet and shortcut automations
- Imports from Pinterest, bookmarks, spreadsheets, or similar apps
- Keep basic capture methods free; reserve advanced automation for paid plans

## Anti-Goals

Things we explicitly won't do:
- Require accounts for basic functionality
- Track user behavior
- Sell or share user data
- Add features that compromise core values
- Optimize for engagement metrics

## Copy & Brand Voice

See [BRAND.md](./BRAND.md) for the full writing guide.

The short version: calm, confident, direct. Specific over general. No hype, no dark patterns — in the product or in how we write about it.

## Design Principles

1. **Simple over clever** - Obvious UX beats innovative UX
2. **Less is more** - Every feature has maintenance cost
3. **Works offline** - Network is a nice-to-have
4. **Respects attention** - No dark patterns, no notification spam

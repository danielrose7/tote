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
- [ ] **Shareable collections** - Public links to collections (opt-in)
- [ ] **Price drop notifications** - Alert when saved items go on sale

### Later
- [ ] Collaborative wishlists
- [ ] Keyboard shortcuts
- [ ] Safari extension

## Anti-Goals

Things we explicitly won't do:
- Require accounts for basic functionality
- Track user behavior
- Sell or share user data
- Add features that compromise core values
- Optimize for engagement metrics

## Design Principles

1. **Simple over clever** - Obvious UX beats innovative UX
2. **Less is more** - Every feature has maintenance cost
3. **Works offline** - Network is a nice-to-have
4. **Respects attention** - No dark patterns, no notification spam

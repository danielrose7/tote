# Backlog

Unscheduled ideas and deferred work. Not prioritized — just a place to avoid losing things.

---

## Infra

### Users table via Clerk webhook

Add a `users (clerk_user_id TEXT PRIMARY KEY, username TEXT, email TEXT, created_at TIMESTAMPTZ)` table in Neon, populated by a `/api/webhooks/clerk` route handling `user.created` and `user.updated` events.

**Why:** Currently `username` is sent from the client at publish time (Clerk has it on the frontend). That works while it's one user, but as more users publish collections the client-sent approach is fragile. A local users table means username lookups are a fast local JOIN with no Clerk API calls or client trust required.

**When:** Before inviting external users to publish collections.

**Rough steps:**

1. Migration: `CREATE TABLE users (clerk_user_id TEXT PRIMARY KEY, username TEXT, email TEXT, created_at TIMESTAMPTZ DEFAULT now())`
2. Add `/api/webhooks/clerk` route — verify Svix signature, handle `user.created` / `user.updated`, upsert into `users`
3. Register webhook in Clerk dashboard
4. Update publish route to JOIN `users` on `owner_clerk_id` instead of trusting client-sent username
5. Backfill existing users via Clerk API one-time script

---

## Curator / Extraction

### Serper.dev as Google-backed alternative to Brave Search

[Serper.dev](https://serper.dev) returns Google search results as JSON — functionally identical to `braveSearch.ts` but backed by Google's index.

**Why consider it:** $0.30–1.00/1k queries (vs Brave at $3–5/1k), faster (1–2s), free 2,500 query trial. Google results have broader coverage than Brave for niche/international products.

**Why not urgent:** Brave is working well and the cost difference doesn't matter at current search volume. Worth revisiting if search becomes a meaningful cost line or if Brave has coverage gaps.

**If implemented:** Mirror `src/lib/braveSearch.ts` — same interface, swap endpoint and auth header.

### URL normalization at save time

Strip tracking params (`utm_*`, `gclid`, `gbraid`, `srsltid`, etc.) when saving URLs in the extension, mobile app, and curator pipeline.

**Why:** The same product URL arrives with different tracking params depending on how the user got there, causing duplicates and mismatched corpus entries.

**Reference:** `normalizeUrl()` in `chrome-extension/scripts/benchmark-cf.ts` — extract to a shared util and call it at save time before writing to Jazz/R2.

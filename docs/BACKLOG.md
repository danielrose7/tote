# Backlog

Unscheduled ideas and deferred work. Not prioritized — just a place to avoid losing things.

---

## SEO / Public Pages

### Accurate `lastModified` timestamps in sitemap

All static routes in `sitemap.ts` currently use `new Date()`, which claims every page was updated on every build — misleading to search engines.

**Fix:** Each static page file exports a `export const lastModified = new Date('YYYY-MM-DD')` constant. `sitemap.ts` imports and uses it. Dynamic collection routes already pull `updatedAt` from the DB, so they're fine.

**When:** Before SEO becomes a meaningful acquisition channel. Low effort, low urgency.

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

### Admin cross-user AI cost and balance dashboard

Expand `/admin` from per-user balances into a lightweight cross-user view of AI usage:
recent curator sessions, chat turns, average/median cost, outliers, current balances,
and total grants/purchases/spend by user.

**Why:** Pricing and credit packs need real usage visibility. The current ledger has the
raw data in `credit_transactions`, but answering "what did the last five curator runs
cost?" still requires ad hoc SQL.

**POC scope:** Add aggregate cards and a recent sessions table to `/admin`; keep Clerk
email enrichment best-effort. No full analytics product, no complex admin adjustment
workflow.

**When:** Before broad beta or before changing credit pack prices.

### Serper.dev as Google-backed alternative to Brave Search

[Serper.dev](https://serper.dev) returns Google search results as JSON — functionally identical to `braveSearch.ts` but backed by Google's index.

**Why consider it:** $0.30–1.00/1k queries (vs Brave at $3–5/1k), faster (1–2s), free 2,500 query trial. Google results have broader coverage than Brave for niche/international products.

**Why not urgent:** Brave is working well and the cost difference doesn't matter at current search volume. Worth revisiting if search becomes a meaningful cost line or if Brave has coverage gaps.

**If implemented:** Mirror `src/lib/braveSearch.ts` — same interface, swap endpoint and auth header.

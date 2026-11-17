# Localization plan

Web app first, then the Chrome extension and the Expo iOS app. Spanish is the first
language. Written 2026-11-14.

Prior art, worth reading before touching this:

- `../sun-calendar/LOCALIZATION.md` — phased rollout, pseudolocale, terminology table,
  core/long-tail split for public pages, a generator that keeps duplicated strings in sync.
- `../story-points/CLAUDE.md` ("Every user-facing string goes through t()") — English
  source strings as keys, fallback to English, `tn()` for plurals, `xx` pseudo-locale.

## Status · 14 November 2026

**Phase 0 — web app: done (English only), local commits, not pushed.**

| Piece | State |
|---|---|
| i18next + react-i18next, per-request instances, English fallback | Done |
| Locale resolution (cookie → Accept-Language → en), `xx` pseudo-locale | Done, verified in a browser (server and client components) |
| `users.locale` (migration 0007) + `GET/PATCH /api/v2/user/preferences` | Done. Migration verified on a throwaway local Postgres, with legacy 017 after it. **Not applied to Neon** — `pnpm build` applies it on deploy. |
| Cookie ↔ profile sync (`LocaleSync`), Settings language picker | Done; picker is hidden until a second locale exists |
| ~530 strings in the authenticated app through `t()` | Done. `pnpm i18n:check`: 534 keys, 0 missing, 0 unused |
| Plurals, enum labels, dates/numbers/prices via `useFormat()` | Done. dayjs removed from the web app |
| API error messages | Done — stable `code` + status-based `t()` messages (`src/i18n/apiError.ts`) |
| **Spanish (es)** — catalog, Clerk UI, LLM output language | Done (machine-authored, **no native review yet**) |
| **German (de)** — app + public catalogs, Clerk UI, LLM output language, `/de/...` pages | Done 16 Nov (machine-authored, **no native review yet**) |

**Measured costs** (the PRODUCT.md bundle-size principle): i18next + react-i18next is
about 18 kB gzip on the client. The English catalog is embedded in each full page load of
the authenticated app, about 22 kB raw / 7 kB gzip, because the layout passes the loaded
catalog to the provider (that is what avoids a flash of English and hydration mismatches).
Client navigations don't re-send it. When a second locale lands, consider splitting the
catalog per route area so a page only ships the areas it uses.

**English wording changes made along the way:** "1 section / 1 item / 1 search / 1 browser
session" no longer pluralize; "1 week ago" (was "1 weeks ago"); "1 item limits …" (was
"1 item limit …"); negative currency renders "-$0.50" (was "$-0.50").

### Phase 1 (Spanish) — done, local commits

- `src/i18n/locales/es/*.json`: neutral Latin American, informal *tú*; "agregar" for Add,
  "colección", "sección", "artículo" (item), "selección", "presupuesto", "publicar",
  "equipo", "invitación". Loaded as a dynamic chunk only for es users.
- Clerk's own UI: `@clerk/localizations` (new dependency) `esMX`, lazy-loaded when the
  locale is es. Public pages' ClerkProvider is not localized yet (needs Phase 2).
- LLM output: `outputLanguageDirective()` (`src/lib/llmLanguage.ts`) appended to chat and
  curator system prompts; `curation/start` carries `locale`. Gift-relationship word list is
  still English-only — review.
- `src/i18n/locales.test.ts` (was `es.test.ts`) guards placeholder/tag parity and full key
  coverage for every non-English locale; `public.test.ts` does the same for public areas.
- Checked in a browser with the cookie `tote-locale=es`: `/import` (server) and
  `/invite/abc` (client) render Spanish, no hydration errors. The Settings picker and
  authenticated pages still need a real Clerk dev instance to see.
- The curator's prompts beyond the system strings (e.g. few-shot examples, the English
  gift word list) were not translated or audited.

### German (de) — done, local commits

Second locale, following the order sun-calendar and story-points ship (en, es, de, fr, pt, ja).

- `src/i18n/locales/de/*.json`: all 13 areas (app + public). Informal *du*, matching both
  sibling projects and our Spanish *tú*. Terms: Sammlung (collection), Abschnitt (section and
  "slot" — same as Spanish *sección*), Artikel (item; plural is identical), Auswahl /
  auswählen (selection), Budget, veröffentlichen, Schnappschuss (snapshot), Einladung,
  Eigentümer / Admin / Bearbeiter / Betrachter (roles), „Ohne Abschnitt“ (ungrouped),
  „hinzufügen“ for Add. German quotes „…“. Example prices in docs/use-cases are in € (US
  copy uses $). Confirmation phrases: „diese Sammlung löschen“, „mein konto löschen“.
- Wiring: `LOCALES`/`LOCALE_LABELS`, `catalogs.ts` loaders (own chunk), `OG_LOCALES`
  (`de_DE`), `useClerkLocalization` (`deDE`), `outputLanguageDirective` (German, informal
  "du"). Pages under `/de/...` come from `PREFIXED_LOCALES`, no route changes.
- **Register mismatch:** Clerk's `deDE` is formal *Sie*, and Clerk ships only that German
  variant. Sign-in and profile screens will read formal; the rest of the app is *du*. Fix
  later with a small override object on top of `deDE` if reviewers mind.
- UI labels quoted in German docs („In Tote speichern“, „Hinzufügen“) must match the
  extension strings when Phase 3 localizes it, same as for Spanish.
- Verified: vitest (134), `pnpm i18n:check` (0 missing), `next build` in a throwaway
  worktree with dummy env — every `/de/...` page prerenders with `lang="de"`, self canonical,
  reciprocal hreflang (en/es/de/x-default), `og:locale` `de_DE`, German titles and headings.
  Not verified: authenticated app in a browser (needs real Clerk), `/de/templates` card data.

### Phase 2 (public pages) — landing, templates, ios-app, chrome-extension, use-cases, docs done

- **URLs:** English unprefixed, Spanish at `/es/...` (`(localized)/[locale]`, static via
  `generateStaticParams`, `dynamicParams = false`). `/en/...` 308-redirects to the unprefixed
  URL in `src/proxy.ts`. Only the pages in `TRANSLATED_PUBLIC_PATHS`
  (`src/i18n/publicPages.ts`) exist in Spanish; `localizedPath()` leaves links to anything
  else on its English URL instead of a 404. Add a path there together with its `[locale]`
  page and its catalog area.
- **`<html lang>`:** there is no top-level `app/layout.tsx` any more. Each route group has a
  root layout built on `app/RootShell.tsx` — `(app)` from the cookie locale, `(public)` English,
  `(localized)/[locale]` from the URL — so the static HTML carries the right language.
- **Catalogs:** marketing strings are separate areas (`site`, `landing`, `templates`,
  `chromeExtension`, `iosApp`), loaded per page by `loadPublicResources` and *not* part of the
  authenticated-app catalog. Server components use `getPublicT(locale, areas)`; the layouts
  give client components (nav, footer, install/auth buttons) the `site` area. Server
  components can't use `<Trans>`; use `withLink()` (`src/i18n/richText.tsx`).
- **SEO:** each translated page has a self-referencing canonical, `hreflang` for every version
  and `x-default` → English (`alternatesFor`, `src/i18n/seo.ts`), and the sitemap lists each
  version with alternates. Footer language switcher lists only pages that exist.
- **Clerk on public pages:** `PublicClerkProvider` lazy-loads the Spanish localization from
  the URL locale.
- **Use cases:** `/use-cases` and its five pages share `UseCaseArticle` (data-driven from the
  `useCases` catalog area + `use-cases/useCasesConfig.ts`); English and `/es` use one
  `[slug]` route each. Public collection titles stay English (user content).
- **Docs:** `/docs` and its eight guides render from `docs/structure.json` (block layout + anchor
  ids, shared by every language) plus a flat list of strings per page in the `docs` catalog area;
  inline markup is `<strong> <em> <code> <a href>` and `<store>`/`<appstore>` (`DocsInline.tsx`).
  Anchor ids stay English so shared `#links` work across languages. FAQ JSON-LD is derived from
  the FAQ section. UI labels quoted in the Spanish docs (e.g. «Guardar en Tote», «Agregar a
  Chrome») must match the extension strings when Phase 3 localizes it.
- **Still English:** `/privacy` (needs legal review), `/s/*` and `/view/*`
  (user content; only the chrome around it could translate). Template collections themselves
  are user content.
- **Fixed on the way:** the English templates title was doubled ("… — Tote — Tote").
- **Adding a page:** copy the pattern of `chrome-extension` — `XPage({ locale })` component,
  `xMetadata(locale)`, thin `page.tsx` for English and a `[locale]/x/page.tsx` for the rest,
  a catalog area in `catalogs.ts`, and the path in `TRANSLATED_PUBLIC_PATHS`.
- Verified in a browser (dummy credentials, throwaway worktree): `lang`, canonical, hreflang,
  sitemap, nav/footer/switcher, no hydration errors. Not verified: `/es/templates` card data
  (needs a database).

### Open items from Phase 0

1. **API errors — done, see above; original plan:** ~126 `NextResponse.json({ error: '…' })` strings are
   English and about six client sites show them directly (`CollectionRequestError` in
   `src/lib/collections/client.ts`, clone, invite, curate import, delete account, create
   collection). Plan: add a stable `code` next to `error`, map codes to `t()` keys on the
   client, and fall back to a status-based generic message. Do it route by route, starting
   with the ones the UI actually shows.
2. **Pre-existing bug found, not fixed:** `ImportPageClient.tsx:~192` still reads
   `!me.$isLoaded || !me.root` (Jazz leftover from `c9032ce`); `me` is never declared, so
   the import button throws when rendered.
3. **Vitest `@/` alias** was missing, so `itemCount.test.ts` failed on `main`; fixed in
   `vitest.config.ts`.
4. `describeRefreshOutcome` now takes `t`; any new caller must pass it.
5. Remaining ~127 `tsc` errors across the repo are pre-existing and unchanged by this work.

**How we verified without touching production:** the repo's `.env.local` (created by the
Vercel CLI) holds live credentials and Development shares the production Neon database, so
the dev server was run from a throwaway `git worktree` with no `.env.local`, dummy Clerk
keys, and a scratch Postgres. Unprotected `(app)` routes (`/import`, `/invite/…`,
`/clone/…`) render signed-out there; authenticated pages (`/collections`, `/settings`)
still need a real Clerk dev instance to check by eye.

## Decisions

| Question | Decision |
|---|---|
| Library | **i18next** (react-i18next) on every surface. One library, one JSON catalog format. Chosen over next-intl because next-intl is Next-only and would leave the extension and Expo app on something else. |
| First locale | **es** (neutral Latin American Spanish). Split to `es-419`/`es-ES` only if reviewers ask. |
| Later locales | de (done), then fr, pt-BR, ja (the set sun-calendar and story-points converged on). Gate on Spanish results. |
| Language setting | **Synced** — stored on the user's profile in Postgres, read and written by all three surfaces via `/api/v2/`. Signed-out fallbacks below. |
| Public-page URLs | **Common standard:** default locale unprefixed (`/docs`), others prefixed (`/es/docs`), `hreflang` + `x-default`, sitemap alternates, translated metadata. |
| Authenticated app URLs | **No prefix.** Locale comes from the profile (cookie when signed out). Collection URLs are shared across mixed-language teams. |
| Not translated | User-authored content (collections, items, notes), admin and dev pages, server logs. |

## Assumptions to confirm

- Docs and use-case pages stay English in the first Spanish pass; landing, templates,
  ios-app and chrome-extension pages are translated first. `/privacy` needs a legal
  review before it is translated.
- Per-device override is not built in v1. iOS's per-app language (Settings → Tote →
  Language) still wins on that device, as the OS applies it before launch.

## Locale resolution

Order, first hit wins:

1. Signed in: `users.locale` (profile).
2. Signed out, web: `NEXT_LOCALE`-style cookie, then `Accept-Language`, then `en`.
3. Signed out, extension: `chrome.storage.local`, then `chrome.i18n.getUILanguage()`.
4. Signed out, Expo: `expo-localization`.

On sign-in the profile value wins. If the profile has none yet, the current signed-out
choice is saved to it. Changing language anywhere writes the profile; other surfaces pick
it up on next launch (and on the existing Ably user channel for the web, if cheap).

Privacy: a locale code is a plain preference. No analytics, no extra collection.

## Phase 0 — Plumbing, English only (no visible change)

1. Add `i18next`, `react-i18next`. **Measure bundle impact before committing** and confirm
   server components work (hooks don't — use i18next directly on the server).
2. `src/i18n/`: init, `resolveLocale()`, catalogs at `src/i18n/locales/<locale>/*.json`
   (namespaced keys, ICU-free i18next plurals via `Intl.PluralRules`), `en` is the source.
3. Fallback to English on a missing key; log missing keys in dev.
4. Generated pseudo-locale `xx` (pad ~40%, accent, bracket) for layout and coverage checks.
5. Root layout: `<html lang>` from the resolved locale. `users.locale` column + migration,
   `/api/v2/` read/write, a language picker in Settings.
6. `src/proxy.ts`: locale resolution for public routes; keep Clerk matching unchanged.
7. **Fix hazards before translating** (found by survey, approximate counts):
   - ~20 manual pluralizations (`=== 1 ? 'item' : 'items'`), e.g. NeonSlotSection,
     NeonCollectionView, PublicCollectionView, TemplatesClient, OfflineBanner;
     server-side `src/lib/extractItem.ts:67`.
   - Sentences split across JSX nodes (NeonSlotSection ~1415–1435) → whole messages.
   - Raw enums as labels: `node.type`, `member.role`, `invite.role` → label maps.
   - `formatPrice` hardcodes `en-US`; `NeonSlotSection:114` has a private duplicate. One
     locale-aware formatter (currency still comes from the item, not the UI locale).
   - dayjs `.fromNow()` / `.format('l LT')` with no locale loaded; bare `toLocaleString()`
     calls follow the *server* locale.
   - ~126 English `NextResponse.json({ error })` strings → error codes mapped to client
     messages. ~42 `setError`/`new Error` sites and toasts.
8. Run the `xx` pseudo-locale over the dialogs (NeonTeamDialog, NeonSlotSection,
   publication/edit/create dialogs) — tightest layouts.

Exit: every user-visible string in the authenticated app goes through `t()`; `xx` shows no
clipped text and no plain-English leftovers; no English-only plural or enum left.

## Phase 1 — Spanish, authenticated app

- Wrap ~420 literals, biggest files first.
- `es` catalog. Seed shared vocabulary from `../story-points/src/locales/es.ts`.
- Clerk: pass `localization={esES}` (Clerk ships Spanish).
- LLM output: add an output-language directive to `src/inngest/prompts.ts` and `api/chat`
  (curated titles, descriptions, questions). Gift-relationship word list is English-only
  — review.
- Terminology table (like sun-calendar's): record the Spanish for collection, slot,
  selection, budget, publish, invite so it isn't re-derived.

## Phase 2 — Public pages

- `src/app` public routes gain locale-prefixed variants for non-default locales.
- Prose pages are whole-page content per locale, not keys. Translate landing, templates,
  ios-app, chrome-extension first.
- `generateMetadata` per locale; `alternates.languages` for hreflang + `x-default`;
  `sitemap.ts` emits alternates; footer language picker listing only pages that exist.
- Watch `AnchorHeading` ids derived from English heading text.
- `/s/[username]/...` stays user content; only the chrome around it translates.

## Phase 3 — Chrome extension

- i18next with bundled catalogs; locale from `chrome.storage` / profile (it already talks
  to the API). Do **not** use `chrome.i18n` for display strings — it has no per-extension
  override. Use `_locales/` only for manifest name/description and the Web Store listing.
- Mind bundle size; load one locale lazily.
- Extraction logic is unaffected and the two extractor files stay in sync as before.

## Phase 4 — Expo iOS app

- `expo-localization` + i18next; enable per-app language via the config plugin
  `supportedLocales`. iOS applies the per-app setting on relaunch.
- Same catalogs where strings overlap (consider a shared package or a generated copy with a
  `--check` step in CI, as sun-calendar does, so they can't drift).
- App Store metadata per locale.

## Later

Native-speaker review of Spanish (nobody has reviewed machine-authored first passes —
sun-calendar flagged the same gap), then de/fr/pt-BR/ja. RTL (Arabic, Hebrew) is a design
problem, not a flip — audit before promising it.

## Risks

- i18next in server components is more setup than next-intl; spike first.
- Catalog drift across three surfaces — needs one source and a CI check.
- Legal text (`/privacy`) in another language.
- Strings built from English grammar in places we haven't found; the pseudo-locale and a
  Spanish run are the only reliable detectors.

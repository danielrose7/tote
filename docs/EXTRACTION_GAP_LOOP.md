# Extraction Gap Loop

A weekly Claude scheduled task that finds sites where link extraction comes back
without a **title**, **image** or **price**, groups them, and works through fixes
one group at a time. This file is the playbook the task follows — edit it here
to change the task's behaviour.

## Data source

`GET https://tote.tools/api/admin/extraction-gaps?days=7`
(`src/app/api/admin/extraction-gaps/route.ts`)

- Auth: `Authorization: Bearer $EXTRACTION_REPORT_TOKEN`. In the cloud
  environment the token is saved as a network secret for `tote.tools`, so the
  proxy adds the header — just `curl` the URL.
- Covers `product`/`link` nodes saved in the window via `extension`, `mobile`,
  `app` or `capture` (imports, curator and copies are excluded).
- A field counts as missing when: title is empty, `Untitled`, or equal to the
  URL; `imageUrl` is empty; `price` is empty.
- Response: `totals` and `byClient` (per-field miss counts — the headline
  metric), and `groups` ranked by count. Each group has a stable `key`
  (`domain|client|fields`, e.g. `zara.com|mobile|image+price`).

**Privacy:** the report is domain-level only. It never includes user ids,
collection data or saved URLs, and the loop must not try to recover them. Find
sample pages on a domain yourself (search, the site's own listings).

## Groups → GitHub issues

Each group is tracked as one issue in `danielrose7/tote` with label
`extraction-gap`, titled `Extraction gap: <domain> · <fields> · <client>`, with
the group `key` on its own line in the body as `gap-key: <key>`.

Each run:

1. Fetch the report. If it fails, stop and report the status code — don't guess.
2. Post a run summary comment on the pinned tracking issue
   `Extraction gap: weekly report` (create it if missing): totals, per-client
   miss rates (`missing / total`), and the change since the last summary.
3. For each group with `count >= 2` (top 15): find its issue by `gap-key`. Create
   one if missing; otherwise comment with the new count. Close issues whose key
   no longer appears and whose fix PR has merged (say so in the closing comment).
   Skip groups whose issue is labelled `wontfix` or `blocked`.

## Fixing a group

Work on **one** group per run — the highest-count open issue with no open PR.

1. Find a public product page on the domain. Fetch it (curl with a desktop
   User-Agent, or Playwright/Chromium which is preinstalled). If the site blocks
   automated fetches or the network policy refuses the host, label the issue
   `blocked`, comment why, and move to the next group (max 3 attempts per run).
2. Confirm the gap reproduces: run the extension extractor against the page
   (see how `sites.test.ts` loads a page into jsdom). If it extracts everything
   fine, the gap is probably client-specific (e.g. mobile WebView timing) or
   already fixed — comment that on the issue instead of changing code.
3. Add a hand-trimmed fixture to
   `chrome-extension/src/lib/extractors/__fixtures__/retailers.ts`, following the
   rules at the top of that file (keep the DOM hooks the extractor uses and the
   decoys; drop scripts, tracking and session data). It runs against both
   extractors via `sites.test.ts` and `mobileParity.test.ts`. Confirm it fails.
4. Fix the extractor. **Apply the same change to both**
   `chrome-extension/src/lib/extractors/index.ts` (or `sites.ts`) and
   `mobile-app/src/lib/extractorScript.ts` (ES5, template literal — double-escape
   regex backslashes). Prefer general fixes (JSON-LD, meta tags, microdata) over
   a per-site adapter when the page uses a standard pattern.
5. `cd chrome-extension && pnpm test:run` — everything must pass. Never skip or
   loosen an existing test to get green.
6. Push a branch `claude/extraction-gap-<domain>` and open a PR that links the
   issue (`Refs #N`, not `Fixes` — the issue closes once the report confirms the
   gap shrank). Never push to `main`: it deploys to production.

## Ending the run

Finish with a short summary: report totals, groups opened/closed, the PR opened
(or why none), and anything blocked.

# Curator UX — Expectation Setting Plan

Actionable improvements to the curator UI based on the principles in `docs/EXPECTATION_SETTING.md`. Each item names the current state, the target, and the relevant files.

---

## 1. Set scope at submission

**Current:** The topic input gives no indication of what kind of output to expect.

**Target:** Add a line beneath the input (or as a subheading on the session page during `started` phase) that names the output type:

```
"We'll research [topic] and build a focused shortlist — typically
15–25 well-chosen items across a handful of categories."
```

**Files:** `src/app/(app)/curate/CuratePageClient.tsx` — the `started` phase block and/or the new-session form.

---

## 2. Label round 1 as "Round 1 of 2" and name what follows

**Current:** `"A few quick questions to anchor the curatorial direction."`

**Target:**

```
"Round 1 of 2. After you answer, we'll research the category
(~30–90s), then come back with a few sharper follow-up questions."
```

**Files:** `CuratePageClient.tsx` — the `questionRound === 1` subheading inside the interview form.

---

## 3. Frame round 2 with what the research found

**Current:** `"A few follow-up questions to sharpen the direction."`

**Target:** Lead with what changed since round 1:

```
"Round 2 of 2. We've researched [topic] — these questions help us
dial in the specifics before we build."
```

The `topic` value is available in the store. If a `researchBrief` summary is ever surfaced from the backend, that's the richer version.

**Files:** `CuratePageClient.tsx` — the `questionRound === 2` subheading.

---

## 4. Add time estimates to indeterminate AI phases

**Current:** Phase labels are static strings with no duration signal.

**Target:** Extend `phaseStatusLabel` or the status header logic to include duration hints for slow phases:

| Phase         | Label                                                     |
| ------------- | --------------------------------------------------------- |
| `researching` | `"Researching the category — usually 30–90s..."`          |
| `framing`     | `"Building curatorial brief — usually under a minute..."` |
| `curating`    | `"Curating the shortlist — usually 60–90s..."`            |

**Files:** `CuratePageClient.tsx` — `phaseStatusLabel` record (line ~44).

---

## 5. Surface the framing brief as a readable artifact

**Current:** `FramingBrief` is parsed from `framingBriefJson` in the Inngest step and published on the `framing-complete` progress event, but never rendered.

**Target:** Once `framingBrief` is in the store, render a card below the activity feed during `planning` / `extracting` phases. Minimum useful fields:

- `goal` — one sentence restating the curatorial intent
- (optionally) `depth`, `aestheticRegister` as quiet metadata

This is an anticipation moment: the user sees what the system understood before the output arrives.

**Files:**

- `src/store/curatorStore.ts` — add `framingBrief: FramingBrief | null` to state + wire `hydrateFromKv` and `applyRealtimeMessage` (the `framing-complete` progress event already carries `framingBriefJson`)
- `CuratePageClient.tsx` — render the card
- `src/inngest/types.ts` — `FramingBrief` type (already defined)

---

## 6. Give the plan reveal more structure

**Current:** Section names appear as inline pills inside an event log entry when the `planned` step fires.

**Target:** Render section names as a small structured list with a framing line:

```
"Here's how we're approaching it:"
  • Budget Essentials
  • Mid-Range Picks
  • Premium Splurges
```

Include a reinforcing scope note: _"A focused selection within each — not a comprehensive guide."_

**Files:** `CuratePageClient.tsx` — the `entry.step === 'planned'` branch inside the event log.

---

## 7. Add intermediate signals to the curating phase

**Current:** Shows a static label for 60–120s with no sub-signals.

**Target:** Use the `detail` field on progress events to carry live updates from the Inngest function. The `planned` step already does this. Extend to:

- `curating`: `"Evaluating N candidates across M sections"`

**Files:**

- `src/inngest/functions/curate-collection.ts` — add `detail` to the relevant `step.realtime.publish` calls
- `CuratePageClient.tsx` — `detail` is already rendered for the latest progress entry; no UI change needed if the backend sends it

---

## 8. Name the expected refinement pass count

**Current:** The sidebar adds "Refine 1", "Refine 2" as passes happen, with no upfront bound.

**Target:** When `refining` phase begins (first `refining-1` progress event), show a note: _"Usually 1–2 refinement passes."_ This converts an open-ended wait into a bounded one.

**Files:** `CuratePageClient.tsx` — the `refining` phase area or the pipeline sidebar.

---

## 9. Design the final reveal

**Current:** Result card shows title, section count, item count, cost. Functional, not memorable.

**Target:** Echo the framing goal back to the user to close the loop between what was promised and what was delivered:

```
"Modern Kitchen Essentials"
4 sections · 22 items · ~$0.18

"Focused on durable, well-reviewed pieces at accessible price points."
  ↑ framingBrief.goal, rendered as a quiet subline
```

This is the peak-end moment — it's weighted most heavily in how the session is remembered.

**Files:** `CuratePageClient.tsx` — the `phase === 'complete' && result` block. Requires `framingBrief` in store (see item 5).

---

## Priority order

Items 2 and 3 (round labeling) are the lowest-effort, highest-signal changes — they fix the most common source of mid-session confusion with a copy edit.

Item 5 (framing brief) unlocks item 9 (final reveal echo) — both require the store wiring first.

Items 4 and 7 (time estimates + intermediate signals) are independent and can be done in any order.

Item 1 (scope at submission) depends on where the new-session entry point lives and may involve a separate page/component.

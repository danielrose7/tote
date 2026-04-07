# Curator Workflow — Architecture & Background

## What this is

A dev-only web UI that runs the `curate-collection` skill as a durable Inngest workflow. Instead of interacting via Claude Code CLI, you run it at `/dev/curate`, answer the interview questions inline, and watch progress stream live. The output collection JSON is written to `collections/` and ready to paste into `/import`.

## Access

Gated behind either:
- `CURATOR_ENABLED=true` in `.env.local` (any logged-in user)
- Clerk `publicMetadata.curator: true` on a specific user account

## Key references

- **Inngest Utah repo** — durable agent harness patterns used here: https://github.com/inngest/utah
- **Inngest Realtime React hooks (v4)** — `useRealtime`, `getClientSubscriptionToken`: https://www.inngest.com/docs-markdown/features/realtime/react-hooks
- **Inngest Realtime human-in-the-loop pattern** — `publish` + `step.waitForEvent`: https://www.inngest.com/docs-markdown/ai-patterns/human-in-the-loop

## Dev setup

Two terminal processes:

```bash
# Terminal 1
pnpm dev

# Terminal 2 (downloads inngest-cli via npx on first run)
pnpm dev:inngest
```

Then navigate to `http://localhost:3000/dev/curate`.

The Inngest dev server UI is at `http://localhost:8288` — use it to inspect function runs, step outputs, and replays.

## Architecture

```
Browser → POST /api/curate/start → inngest.send("curation/start")
                                         │
                              ┌──────────┴──────────┐
                              │                     │
              acknowledge-curation          curate-collection
              (instant feedback)            (the full pipeline)
                              │                     │
                              └──────────┬──────────┘
                                         │
                              Realtime channel: curation:<sessionId>
                                         │
                                  topics: interview
                                          progress
                                          result
                                         │
                              Browser ← useRealtime (inngest/react)
```

## Inngest patterns used (from Utah)

| Pattern | Where |
|---|---|
| Singleton concurrency | `concurrency: { key: "event.data.sessionId", limit: 1 }` |
| Cancel on restart | `cancelOn: [{ event: "curation/start", if: "..." }]` |
| Named per-iteration steps | `step.run("research-${slug}")` in section loop |
| Instant acknowledgment function | `acknowledge-curation.ts` fires in parallel with main function |
| Context pruning | `src/inngest/lib/prune.ts` — trims tool results >4K chars |
| Workspace context injection | `src/inngest/workspace/CURATOR.md` injected into system prompts |
| Human-in-the-loop | `publish(ch.interview, ...)` + `step.waitForEvent("wait-for-answers")` |

## File map

```
src/inngest/
  client.ts                    Inngest client (id: "tote")
  channels.ts                  curationChannel — interview / progress / result topics
  curator-auth.ts              isCurator() — env or Clerk publicMetadata gate
  types.ts                     Event types + CollectionOutput shape
  prompts.ts                   System prompts + prompt builder functions
  lib/prune.ts                 Utah-style context pruning for tool results
  workspace/CURATOR.md         Curator persona injected into all Claude prompts
  functions/
    acknowledge-curation.ts    Instant feedback on curation/start
    curate-collection.ts       Full pipeline: interview → plan → research → curate → write

src/app/
  (dev)/
    layout.tsx                 ClerkProvider + curator gate
    curate/
      page.tsx                 Server component shell
      actions.ts               Server action: fetchRealtimeToken()
      CuratePageClient.tsx     Client UI — phases: idle → interview → running → complete
  api/
    inngest/route.ts           Inngest serve() handler
    curate/start/route.ts      POST → curation/start event
    curate/answer/route.ts     POST → curation/answers event

collections/                   Output directory (checked into git)
```

## Evolution notes

- **LLM provider**: Currently uses `@anthropic-ai/sdk` directly. Could be swapped for `pi-ai` (Utah's provider-agnostic layer) or `@inngest/agent-kit` if the research step needs richer agent loop control.
- **Research tool**: Uses Anthropic's `web_search_20250305` built-in tool. Can be replaced with Brave/Tavily if more control over search results is needed.
- **Interview UI**: Currently free-text inputs. Could be enhanced with the same multi-select option UI as the Claude Code `AskUserQuestion` skill interaction.

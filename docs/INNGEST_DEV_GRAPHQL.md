# Inngest Dev Server GraphQL API

The Inngest dev server at `localhost:8288` exposes a GraphQL API useful for inspecting run state, step traces, and step outputs. The curator uses this to sync UI state when the Realtime websocket drops.

## Endpoint

```
POST http://localhost:8288/v0/gql
Content-Type: application/json
```

Configured via `INNGEST_DEV_SERVER_URL` env var (defaults to `http://localhost:8288`).

> **Important:** The Inngest dev server does **not** support GraphQL variables (`$var` syntax). Always inline values directly into the query string. Sending a `variables` field in the request body causes a 422 response.

## Key Queries

### Find runs by event data

```graphql
query FindRun($from: Time!, $query: String!) {
  runs(
    filter: { from: $from, query: $query }
    orderBy: [{ field: QUEUED_AT, direction: DESC }]
  ) {
    edges { node { id status } }
  }
}
```

Variables:
```json
{
  "from": "2026-04-01T00:00:00Z",
  "query": "event.data.sessionId == \"<uuid>\""
}
```

Notes:
- `orderBy` is **required** (omitting it causes a validation error)
- `from` is required in the filter
- `query` is a CEL expression against the triggering event payload
- Take `edges[0].node` for the most recent matching run

### Get full step trace

```graphql
query GetTrace($runID: ULID!) {
  runTrace(runID: $runID) {
    childrenSpans {
      name      # matches the ID passed to step.run() or step.realtime.publish()
      status    # COMPLETED | RUNNING | WAITING | FAILED
      stepType  # RUN | WAIT_FOR_EVENT | step.realtime.publish
      outputID  # opaque token — pass to runTraceSpanOutputByID
    }
  }
}
```

Notes:
- Returns a **flat** list of all steps despite the field being named `childrenSpans`
- `run(runID).trace.childrenSpans` only returns top-level wait steps — use `runTrace` for the full list
- Step names exactly match the first argument to `step.run("name", ...)` and `step.realtime.publish("name", ...)`

### Fetch a step's output

```graphql
query GetOutput($outputID: String!) {
  runTraceSpanOutputByID(outputID: $outputID) {
    data                    # JSON string — must be JSON.parse()'d
    error { name message }  # error requires subfield selection (not a scalar)
  }
}
```

Notes:
- Works for both `step.run` and `step.realtime.publish` steps
- `data` is the serialized return value of the step
- `outputID` comes from `childrenSpans[n].outputID` in the trace query

## Step Name Mapping for `curate-collection`

| Inngest step name | UI phase | Output shape |
|---|---|---|
| `interview-questions` | — | questions array |
| `interview-sent` | `started` | — |
| `wait-for-answers` | waiting | — |
| `answers-received` | `running` | — |
| `plan-collection` | — | `{ title, intro, sections: [{ title, slug }] }` |
| `planned` | `running` | — |
| `searching-<slug>` | `running` | — |
| `find-urls-<slug>` | — | `{ urls: string[] }` |
| `found-urls-<slug>` | `running` | — |
| `persist-session-urls` | — | writes `collections/.sessions/<sessionId>.json` |
| `urls-ready` | `extracting` | — |
| `extraction-queued` | `extracting` | — |
| `wait-for-extractions` | waiting | — |
| `extractions-received` | `running` | — |
| `curating` | `running` | — |
| `curate-and-write` | — | `{ filePath, title, sectionCount, itemCount }` |
| `result` | `complete` | — |
| `complete` | `complete` | — |

## Usage in Tote

`GET /api/curate/sync/[sessionId]` queries these APIs to reconstruct full session state (phase, progress entries, result, urlSections). Called by the Reconnect button in the curator UI when realtime messages are missed.

Source: `src/app/api/curate/sync/[sessionId]/route.ts`

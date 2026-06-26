# <Project Or Task> Runbook

Status: active
Last updated: <YYYY-MM-DD>

Use this file for repeatable operator steps. Keep project rationale in the
North Star and active status in the tracker.

## Prerequisites

- <Tool, environment, permission, local state, or input required.>

## Steps

1. <Step>

```powershell
<command>
```

Expected result:
<Expected output or state.>

## Failure Handling

| Symptom | Likely cause | Recovery |
|---|---|---|
| <symptom> | <cause> | <recovery> |

## Outputs

| Output | Location | Durable or transient |
|---|---|---|
| <output> | <path/link> | <durable/transient> |

## Artifact Rules

- Preserve durable summaries, decisions, verification evidence, and next
  actions.
- Keep raw logs, caches, generated manifests, click receipts, and local run
  state external or ignored unless the North Star or audit rules say otherwise.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/agent-workflows/living-project-task-protocol/templates/RUNBOOK.md","sha256WithoutMarker":"c565f17a007874876a86d28cbcfb9b9aaa0bf3235075b50c92e73eaa197d95b1","markedAtUtc":"2026-06-25T22:57:26.965Z"} -->

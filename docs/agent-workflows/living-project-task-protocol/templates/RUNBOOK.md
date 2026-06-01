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

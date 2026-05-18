# Jules Outsourcing Pipeline

**Last Updated:** 2026-05-14

## Purpose

This guide explains how Codex should outsource bounded Aralia tasks to Google Jules without giving Jules broad control over the repository.

The system has two parts:

- `.jules/orchestrator/cli.ts` is the command surface Codex uses to validate manifests, call the Jules API, launch sessions, refresh status, and write dashboard state.
- `.jules/dashboard/index.html` is the human and agent dashboard that reads `.jules/runs/jules-dashboard.json`.

## Operating Modes

### Scout

Use Scout mode for investigation, mapping, and documentation findings. Scout tasks may write to one narrow worklog or report file, but should not change application code.

### Worker

Use Worker mode for one bounded implementation slice. Every Worker task must declare exact read scopes, write scopes, forbidden files, and verification commands.

### Batch

Use Batch mode only when multiple task packets have disjoint write scopes. The manifest validator rejects overlapping write scopes so parallel Jules sessions do not collide.

## Safety Boundary

Codex coordinates the pipeline. Jules executes bounded packets.

Default boundary:

- Jules may create sessions and PRs when the manifest allows it.
- Codex must validate manifests before launch.
- Codex must refresh dashboard state after launch.
- Codex or the user must review resulting PRs before merge.
- No auto-merge is part of this first system.

## Full Delivery Lifecycle

The Jules session is only the cloud-worker stage. Treat a task as complete only after the full path is closed:

1. Package a bounded manifest with read scopes, write scopes, forbidden files, verification, and operating mode.
2. Validate the manifest before launch.
3. Launch Jules through the API and monitor with `status`, `watch`, and `activities`.
4. Approve plans or send bounded feedback only when the manifest scope remains safe.
5. Retrieve outputs through a PR link or a validated activity patch artifact.
6. Review the changed files against the manifest write scopes and record accept, repair, or reject disposition.
7. If Jules or Codex creates a GitHub PR, wait for required GitHub checks and verify the GitHub Pages build/load path is not broken.
8. Merge to GitHub `master` only after the PR is green and reviewed.
9. Sync the local checkout from GitHub `master`.
10. Refresh Jules state with `status` or `watch`, then reload the dashboard so local status matches the remote delivery state.

If any stage fails, keep the dashboard state honest and repair at that stage instead of treating a completed Jules session as merged work.

## Manifest Shape

Example:

```json
{
  "runId": "2026-05-14-smoke",
  "source": "sources/github/Gambitnl/Aralia",
  "startingBranch": "master",
  "requirePlanApproval": true,
  "automationMode": "NONE",
  "tasks": [
    {
      "id": "jules-doc-scout",
      "title": "Scout Jules documentation surfaces",
      "persona": "scribe",
      "mode": "scout",
      "prompt": "Inspect .jules and docs agent-facing surfaces.",
      "readScopes": ["AGENTS.md", ".jules", "docs/@AI-PROMPT-GUIDE.md"],
      "writeScopes": [".jules/worklogs/worklog_scribe.md"],
      "forbiddenFiles": ["package-lock.json"],
      "verification": ["State whether documentation-only verification was sufficient."]
    }
  ]
}
```

## Commands

Validate a manifest:

```powershell
npx tsx .jules/orchestrator/cli.ts validate .jules/runs/example-smoke-manifest.json
```

Render the exact prompt for one task:

```powershell
npx tsx .jules/orchestrator/cli.ts prompt .jules/runs/example-smoke-manifest.json jules-doc-scout
```

Validate the example Worker and Batch manifests:

```powershell
npx tsx .jules/orchestrator/cli.ts validate .jules/runs/example-worker-manifest.json
npx tsx .jules/orchestrator/cli.ts validate .jules/runs/example-batch-manifest.json
```

List Jules sources visible to `JULES_API_KEY`:

```powershell
npx tsx .jules/orchestrator/cli.ts sources
```

List session activities, progress messages, and artifacts:

```powershell
npx tsx .jules/orchestrator/cli.ts activities 10863889126770106346 50 .jules/runs/2026-05-14-smoke/activities.json
```

Save the latest Jules patch artifact after validating it against the task write scope:

```powershell
npx tsx .jules/orchestrator/cli.ts patch .jules/runs/example-smoke-manifest.json jules-doc-scout 10863889126770106346
```

Write dashboard JSON without launching remote work:

```powershell
npx tsx .jules/orchestrator/cli.ts dashboard .jules/runs/example-smoke-manifest.json
```

Launch all tasks in a validated manifest:

```powershell
npx tsx .jules/orchestrator/cli.ts launch .jules/runs/example-smoke-manifest.json
```

Refresh status for a launched run:

```powershell
npx tsx .jules/orchestrator/cli.ts status .jules/runs/example-smoke-manifest.json
```

Watch a launched run until it completes, fails, or needs human/Codex action:

```powershell
npx tsx .jules/orchestrator/cli.ts watch .jules/runs/example-smoke-manifest.json 30 30
```

Approve a Jules plan after reviewing it in the session UI:

```powershell
npx tsx .jules/orchestrator/cli.ts approve <session-id>
```

Print the local review checklist for a launched run:

```powershell
npx tsx .jules/orchestrator/cli.ts review .jules/runs/example-smoke-manifest.json
```

## Dashboard

Open the dashboard through the dev server:

```text
http://127.0.0.1:5174/Aralia/.jules/dashboard/index.html
```

The dashboard shows:

- total tasks
- running tasks
- tasks needing plan approval or user feedback
- completed tasks
- failed tasks
- write scopes
- verification expectations
- Jules session links and PR links when available

## Current First Slice

Implemented:

- manifest validation
- prompt rendering
- Jules session request construction
- Windows user-environment fallback for `JULES_API_KEY`
- API source listing
- API activity listing for progress, messages, and artifacts
- safe patch artifact retrieval with manifest boundary validation
- plan approval and session message commands
- unattended watch command for completed, failed, and human-needed states
- completed-session pull path through the Jules CLI
- dashboard JSON generation
- static dashboard UI
- Scout, Worker, and Batch example manifests

Deferred:

- automated PR diff review
- batch manifest generator
- merge policy automation

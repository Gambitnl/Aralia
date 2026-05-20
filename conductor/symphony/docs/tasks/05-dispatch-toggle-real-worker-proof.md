# Task 05: Dispatch Toggle Real Worker Proof

## Status

Blocked pending explicit operator approval for a real worker start.

## Purpose

Prove the dashboard dispatch toggle gates real worker assignment: no worker starts while dispatch is paused, and a worker starts only after the operator enables dispatch.

## Current Boundary

This task should run after the dashboard handoff path is clearer. It is about local worker dispatch gating, not Linear/Jules mutation.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/src/orchestrator.ts`
- `conductor/symphony/src/server.ts`
- `conductor/symphony/public/dashboard.js`
- `conductor/symphony/scripts/verify-dispatch-control-toggle.mjs`
- `conductor/symphony/scripts/verify-dashboard-only-mode.mjs`

## Preconditions

1. Repo is clean and synced.
2. Use a safe mock tracker or a clearly bounded real candidate.
3. Operator understands this task may start a local worker after dispatch is enabled.
4. Do not use a candidate that can mutate external systems unless separately approved.

## Work

1. Start Symphony normally or with the chosen safe workflow config.
2. Confirm startup state:
   - dispatch paused
   - running workers: 0
   - retrying workers: 0
   - worker roster empty
3. Confirm task/candidate exists or can be fetched without dispatch.
4. Wait through at least one poll interval while dispatch is paused.
5. Prove no worker starts.
6. Enable dispatch via dashboard or:
   - `POST /api/v1/dispatch-control`
7. Confirm dispatch state changes to enabled.
8. Observe whether a worker starts or becomes eligible.
9. Capture worker identity and assignment evidence if it starts.
10. Pause dispatch again.
11. Confirm no new workers start after pause and retries are held.
12. Stop any test worker/processes cleanly.

## Acceptance Criteria

- Before enablement: no worker starts.
- After enablement: assignment starts or becomes eligible according to candidate availability.
- After pause: no new assignment starts.
- API state and dashboard state agree.
- No stray worker/Symphony processes remain.
- Proof artifacts are saved.

## Suggested Proof Artifacts

- `dispatch-paused-before-enable-2026-05-19.json`
- `dispatch-enabled-worker-start-2026-05-19.json`
- `dispatch-paused-after-worker-2026-05-19.json`
- `dispatch-toggle-real-worker-proof-2026-05-19.md`

## Response

Current status recorded by Codex on 2026-05-19.

Use this structure:

- Summary: This task intentionally remains unrun because it may start a local worker after dispatch is enabled. Existing contract tests prove the toggle defaults to paused and can be switched, but the requested real-worker proof needs operator approval and a safe candidate.
- Workflow/tracker used: None selected.
- Approval source: Not provided in this session.
- Commands run: Not run for real dispatch.
- Before enablement: Existing contracts cover default paused state; no fresh live worker proof captured here.
- After enablement: Not tested with a real worker.
- After pause: Not tested with a real worker.
- Worker evidence: None.
- Cleanup: No worker/Symphony process was started for this task.
- Remaining blockers: Operator approval to enable dispatch against a safe mock or bounded candidate, plus agreement on which candidate may be allowed to start.
- Proof artifacts: None new for Task 05 in this session.

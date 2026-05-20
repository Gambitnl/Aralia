# Task 03: Jules Manifest Staging Proof

## Status

Completed for ARA-6; this task file is superseded by the live ARA-6 evidence.

## Purpose

After a dashboard draft has a Linear receipt, prove Symphony can stage the `.jules` manifest and record the manifest path without launching Jules.

## Current Boundary

This task starts after Linear creation proof. The expected next boundary is Jules manifest staging.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md`
- `conductor/symphony/src/server.ts`
- `conductor/symphony/src/task-intake.ts`
- Relevant proof artifacts from Task 02 once available

## Preconditions

1. Repo is clean and synced before starting.
2. Symphony is running dashboard-only with dispatch paused.
3. A dashboard-created draft has a Linear issue receipt.
4. Handoff readiness shows Linear complete and Jules manifest staging as the current boundary.
5. Operator explicitly approves local `.jules` manifest staging.

## Work

1. Confirm dispatch paused and zero workers.
2. Confirm Git preflight is clean.
3. Inspect the Jules manifest preview for the selected draft/handoff.
4. Confirm preview says:
   - would stage/write manifest if the staging endpoint is called
   - preview itself does not mutate local files
   - blockers are empty or understood
5. Ask for or confirm explicit operator approval before local file mutation.
6. Call the manifest staging endpoint for the selected handoff.
7. Capture the staging response.
8. Confirm the `.jules/runs/.../manifest.json` path exists.
9. Confirm Symphony state records:
   - handoff id
   - manifest path
   - launch command
   - status command
   - records path
10. Do not launch Jules.

## Acceptance Criteria

- A manifest is staged exactly once for the selected handoff.
- Manifest content matches the previewed shape.
- Symphony records the manifest path and launch/status commands.
- Jules launch readiness becomes visible after staging.
- No Jules session is launched.
- No Linear issue is created by this task.
- No worker dispatch is enabled.
- Proof artifacts are saved under `conductor/symphony/.symphony/live-proof/`.

## Suggested Proof Artifacts

- `jules-manifest-preview-before-stage-2026-05-19.json`
- `jules-manifest-stage-response-2026-05-19.json`
- `jules-launch-readiness-after-stage-2026-05-19.json`
- `jules-manifest-staging-proof-2026-05-19.md`

## Response

Current status recorded by Codex on 2026-05-20.

- Summary: ARA-6 proved manifest staging through the existing `.jules/orchestrator` path. The next live work is no longer staging; it is post-launch state reconciliation and PR/check handling.
- Approval source: Operator approved continuing the Symphony Task 02 payload through the next advised steps.
- Draft/handoff id: `handoff-1779226708033-v4ohk7`.
- Manifest path: Staged by Symphony during the ARA-6 run; see the proof artifacts below.
- Files changed: This status note only.
- Verification: Manifest staging and launch-readiness proof artifacts were captured during the ARA-6 flow.
- External mutations: None from staging itself.
- Local mutations: One approved `.jules` manifest/runtime record set was created by Symphony; runtime files are intentionally ignored.
- Current boundary: Superseded by Task 04 and PR #931 follow-through.
- Remaining blockers: None for Task 03 itself.
- Proof artifacts: `jules-manifest-staging-proof-2026-05-19.json` and `launch-readiness-after-manifest-stage-2026-05-19.json`.

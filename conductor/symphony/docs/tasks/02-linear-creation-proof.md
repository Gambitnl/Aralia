# Task 02: Linear Creation Proof

## Status

Completed for ARA-6; this task file is superseded by the live ARA-6 evidence.

## Purpose

Prove the first real external mutation in the dashboard-started Symphony path: creating a Linear issue from a clean-Git dashboard draft and recording the Linear receipt.

## Current Boundary

Task 2b proved the current boundary is `linear_issue` with `canRunNow: true` and the next safe action:

`POST /api/v1/task-drafts/:id/create-linear`

This task may call that endpoint only with explicit operator approval.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/src/server.ts`
- `conductor/symphony/src/task-intake.ts`
- `conductor/symphony/src/linear-client.ts`
- `conductor/symphony/.symphony/live-proof/clean-git-linear-boundary-proof-2026-05-19.md`
- `conductor/symphony/.symphony/live-proof/handoff-readiness-linear-boundary-2026-05-19.json`
- `conductor/symphony/.symphony/live-proof/linear-preview-ready-2026-05-19.json`

## Preconditions

1. Repo is clean and synced:
   - `git status --short --branch`
   - expected: `## master...origin/master`
2. Symphony starts dashboard-only with dispatch paused.
3. `GET /api/v1/state` shows zero running workers.
4. `POST /api/v1/git-preflight` returns `ok: true`.
5. A dashboard draft exists with `linear_issue` as the current boundary.
6. The operator explicitly approves creating exactly one Linear issue for the selected draft.

## Work

1. Start Symphony dashboard-only on a free port.
2. Confirm dispatch is paused and no workers are running.
3. Confirm the draft's Linear preview:
   - `canCreateNow: true`
   - `wouldCreateLinearIssue: true`
   - `mutatesExternalSystems: false` for preview
   - `blockers: []`
4. Ask for or confirm explicit operator approval before mutation.
5. Call:
   - `POST /api/v1/task-drafts/:id/create-linear`
6. Capture the response.
7. Re-fetch:
   - `/api/v1/task-drafts`
   - `/api/v1/task-drafts/:id/handoff-readiness` if available
   - `/proof` or dashboard proof surface if useful
8. Confirm the Linear receipt is recorded:
   - Linear issue id
   - Linear identifier
   - Linear URL
   - creation timestamp
9. Confirm the current boundary advances to Jules manifest staging or equivalent next waiting/ready state.
10. Do not stage a Jules manifest in this task unless explicitly authorized separately.

## Acceptance Criteria

- Exactly one Linear issue is created for the selected draft.
- The issue receipt is stored in Symphony draft/handoff state.
- The dashboard/API shows Git sync complete and Linear issue complete.
- The next boundary is Jules manifest staging/preparation.
- No Jules manifest is written.
- No Jules session is launched.
- No worker dispatch is enabled.
- Proof artifacts are saved under `conductor/symphony/.symphony/live-proof/`.
- Audit/spec are updated only for facts proven by this run.

## Suggested Proof Artifacts

- `linear-create-response-2026-05-19.json`
- `task-drafts-after-linear-create-2026-05-19.json`
- `handoff-readiness-after-linear-create-2026-05-19.json`
- `linear-creation-proof-2026-05-19.md`

## Response

Current status recorded by Codex on 2026-05-20.

- Summary: ARA-6 proved the Linear creation boundary. Symphony created exactly one Linear issue after clean Git preflight and recorded the issue receipt.
- Approval source: Operator approved using the weapon-proficiency regression task as the payload and approved creating exactly one Linear issue through Symphony after clean Git preflight.
- Draft id: ARA-6 dashboard draft/handoff sequence; see the audit for the exact proof artifact chain.
- Linear issue: `ARA-6`, `https://linear.app/aralia/issue/ARA-6/add-regression-coverage-for-non-proficient-weapon-attack-penalties`.
- Files changed: This status note only.
- Verification: `linear-creation-proof-2026-05-19.json` is the live proof artifact referenced by the audit.
- External mutations: One approved Linear issue creation.
- Local mutations: Symphony runtime/proof artifacts only; runtime state is intentionally ignored unless selected as durable proof.
- Current boundary: Superseded by Task 03/04 and the ARA-6 Jules/GitHub follow-through.
- Remaining blockers: None for Task 02 itself.
- Proof artifacts: `conductor/symphony/.symphony/live-proof/linear-creation-proof-2026-05-19.json`.

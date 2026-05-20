# Task 04: Jules Launch Readiness And Launch Proof

## Status

Launch completed for ARA-6; post-launch reconciliation remains open.

## Purpose

Prove Jules launch readiness after manifest staging, then either stop at readiness or, with explicit operator approval, launch Jules and capture the session receipt.

## Current Boundary

This task starts after a `.jules` manifest has been staged and launch readiness is visible.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/src/server.ts`
- `conductor/symphony/src/task-intake.ts`
- `conductor/symphony/scripts/verify-jules-launch-readiness-packet.mjs`
- Relevant proof artifacts from Task 03 once available

## Preconditions

1. Repo is clean and synced.
2. Dispatch is paused.
3. A dashboard-started handoff has:
   - Linear issue receipt
   - staged `.jules/runs/.../manifest.json`
   - launch command
   - status command
4. Launch readiness endpoint reports `canLaunchNow: true` or a clearly explained blocker.
5. Actual launch requires explicit operator approval.

## Work

1. Start Symphony dashboard-only.
2. Confirm dispatch paused and zero workers.
3. Inspect launch readiness for the staged handoff.
4. Capture readiness packet:
   - launch URL
   - launch command
   - status command
   - manifest path
   - records path
   - Linear receipt
   - base commit
   - mutation flags
   - blockers
5. If launch is not approved, stop after readiness proof.
6. If launch is approved:
   - call the launch endpoint
   - capture the response
   - confirm Jules session id/url/state is recorded
   - refresh status once if the API provides a read-only refresh
7. Do not approve Jules plans, send feedback, or merge/sync PRs in this task unless separately authorized.

## Acceptance Criteria

Readiness-only success:

- Launch readiness is visible and accurate.
- No Jules launch occurs.
- All mutation flags and blockers are explicit.

Launch success, only if approved:

- Jules launch endpoint is called once.
- Session id/url/state is recorded.
- Dashboard/API advances to Jules session tracking.
- No worker dispatch is enabled.
- No PR/local sync mutation is performed.
- Proof artifacts are saved.

## Suggested Proof Artifacts

- `jules-launch-readiness-ready-2026-05-19.json`
- `jules-launch-response-2026-05-19.json` if launch is approved
- `jules-status-after-launch-2026-05-19.json` if launch is approved
- `jules-launch-proof-2026-05-19.md`

## Response

Current status recorded by Codex on 2026-05-20.

- Summary: ARA-6 proved launch readiness and launch into Jules session `4101281510355198885`. It also exposed the important follow-up gap: local Jules/Symphony status reported `COMPLETED` with `pullRequestUrl: null`, while browser and GitHub evidence showed more state existed.
- Approval source: Operator approved continuing after the Linear/staging boundary.
- Handoff id: `handoff-1779226708033-v4ohk7`.
- Readiness result: Launch readiness was captured before launch and after manifest staging.
- Launch result: Jules session `https://jules.google.com/session/4101281510355198885` was created. Later GitHub evidence found PR #931 from the same session.
- Commands run: See the audit for captured Symphony API and GitHub read-only commands.
- Verification: Launch proof exists; reconciliation proof remains incomplete because Symphony did not detect PR #931 from the local `pullRequestUrl` field.
- External mutations: One approved Jules launch.
- Local mutations: Symphony/Jules runtime records only; runtime files are intentionally ignored.
- Current boundary: Post-launch reconciliation and PR #931 check handling.
- Remaining blockers: Implement/prove fallback PR discovery, refresh PR #931 through Symphony, and surface the current CI/setup blockers.
- Proof artifacts: `jules-launch-proof-2026-05-19.json`, `launch-readiness-after-jules-launch-2026-05-19.json`, and GitHub PR #931.

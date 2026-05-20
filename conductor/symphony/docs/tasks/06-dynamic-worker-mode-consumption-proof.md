# Task 06: Dynamic Worker Mode Consumption Proof

## Status

Completed locally; live worker launch proof remains a separate approval-gated follow-up.

## Purpose

Prove that Symphony's complexity-based worker-mode recommendation is not only displayed as a packet, but is consumed by a real launch/readiness path while explicit workflow config overrides still win.

## Current Boundary

Worker-mode packets already recommend modes such as `operator_only`, `local_fast`, `local_careful`, `jules_task`, `jules_plan`, and `observe_wait`. This task proves the recommendation influences a launch/readiness decision or actual worker launch.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/src/task-intake.ts`
- `conductor/symphony/src/orchestrator.ts`
- `conductor/symphony/src/agent-runner.ts`
- `conductor/symphony/src/prompt-renderer.ts`
- `conductor/symphony/scripts/verify-worker-mode-packet.mjs`
- `conductor/symphony/scripts/verify-codex-worker-assignment.mjs`
- `conductor/symphony/scripts/verify-worker-dashboard.mjs`

## Work

1. Trace where worker-mode recommendation is created.
2. Trace where worker launch/readiness consumes model and reasoning effort.
3. Identify any gap between recommendation packet and actual launch/readiness behavior.
4. If missing, implement the smallest safe bridge so the recommendation is used.
5. Preserve explicit override priority:
   - explicit `codex.model` wins over automatic recommendation
   - explicit `codex.reasoning_effort` wins over automatic recommendation
6. Add or update verification for:
   - default recommendation path
   - explicit override path
   - at least one local mode
   - at least one Jules mode or Jules readiness packet
7. Avoid broad routing refactors.

## Acceptance Criteria

- A recommendation visibly affects worker launch/readiness or launch packet content.
- Explicit config overrides still win.
- Dashboard/API exposes what was recommended and what was actually used.
- Verifier coverage proves both recommendation and override behavior.
- Audit/spec are updated with exact proof and remaining limits.

## Suggested Proof Artifacts

- `worker-mode-consumption-default-2026-05-19.json`
- `worker-mode-consumption-override-2026-05-19.json`
- `worker-mode-consumption-proof-2026-05-19.md`

## Response

Implemented by Codex on 2026-05-19.

Use this structure:

- Summary: Added a resolved worker-mode consumption policy so the dashboard/API no longer only displays the recommendation. The task queue now exposes recommended versus actually-used model/reasoning, and Jules launch-readiness packets carry the same policy before any launch mutation occurs.
- Files changed: `src/task-intake.ts`, `src/server.ts`, `public/dashboard.js`, `scripts/verify-worker-mode-consumption.mjs`, `scripts/verify-jules-launch-readiness-packet.mjs`, `package.json`, `docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`, `docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md`, and `JULES_MIDDLEMAN_AUDIT.md`.
- Recommendation path: `TaskIntakeStore` still builds `taskRouting.workerMode` from draft/handoff evidence and complexity signals.
- Consumption path: `HttpServer` resolves that recommendation against active WORKFLOW.md Codex config and publishes the result as `taskRouting.workerMode.consumption` plus `handoff.launch_readiness.workerModePolicy`.
- Override behavior: Explicit `codex.model` and `codex.reasoning_effort` win. Without explicit model, `default` means app-server default. Without explicit reasoning effort, the worker-mode recommendation supplies the actual reasoning effort unless the mode is `operator_only`.
- Commands run: `npm run build`, `node scripts/verify-jules-launch-readiness-packet.mjs`, `node scripts/verify-worker-mode-consumption.mjs`.
- Verification: Focused build and verifier run passed. Full `verify:jules-contract` still needs to be rerun after all task-doc/doc updates.
- Current status: Completed for local API/readiness consumption proof.
- Remaining blockers: A real worker launch using the consumed policy is still approval-gated by Task 05 and should not be folded into this local proof.
- Proof artifacts: `verify-worker-mode-consumption.mjs` is the durable local contract; no separate live-proof JSON file was saved in this session.

# Symphony Open Task Order

This file is the canonical index and ordered queue for the Symphony/Jules middleman track. It organizes proof tasks, baseline contracts, and historical closeout reports into a clean, easy-to-digest roadmap.

## Workflow Status Index

For details on each task, including the specific proof logs, timing diaries, and terminal validation captures, click through to the dedicated task files linked below.

### Historical Milestones & Closeout Records

| ID | Status | Subject | Closeout / Proof Record | Key PRs / Commits |
|---|---|---|---|---|
| **Historical ARA-6 Proof Thread** | `done` | Add regression coverage for non-proficient weapon attack penalties | [ARA-6_CLOSEOUT_REPORT.md](./ARA-6_CLOSEOUT_REPORT.md) | PR #931 / PR #932 / `28ff49a6` |
| **P2** | `done` | Premade party gear, AC conversion logic, & ranged weapon ranges | [PACKAGE_2_CLOSEOUT_REPORT.md](./PACKAGE_2_CLOSEOUT_REPORT.md) | PR #935 / PR #936 |

### Proving-Ground Baseline Contracts

| Order | Status | Subject | Details File |
|---|---|---|---|
| 1 | `done` | Integration Health Checks (Smoke Tests) | [01-integration-health-checks.md](./01-integration-health-checks.md) |
| 2 | `done` | Linear Issue Creation Proof | [02-linear-creation-proof.md](./02-linear-creation-proof.md) |
| 3 | `done` | Jules Manifest Staging Proof | [03-jules-manifest-staging-proof.md](./03-jules-manifest-staging-proof.md) |
| 4 | `done` | Jules Launch Readiness and Launch Proof | [04-jules-launch-readiness-and-launch-proof.md](./04-jules-launch-readiness-and-launch-proof.md) |
| 5 | `deferred` | Dispatch Toggle & Real Worker Proof | [05-dispatch-toggle-real-worker-proof.md](./05-dispatch-toggle-real-worker-proof.md) |
| 6 | `deferred` | Dynamic Worker Mode Consumption Proof | [06-dynamic-worker-mode-consumption-proof.md](./06-dynamic-worker-mode-consumption-proof.md) |

---

## Active Proving-Ground: Spell Phase 1

For the active proving-ground Spell Phase 1 track:
- Packages 1, 2, 3, and 4 are fully merged and completed.
- The active frontier has advanced to **Package 5** (AI arbitration pilot) and **Package 6** (first mechanics bucket closure).
- The detailed checklist and adjacent gap log for early-game spells live in [SPELL_PHASE_1_TASK_TRACKER.md](../../../docs/tasks/spells/SPELL_PHASE_1_TASK_TRACKER.md).

---

## Governance & Proving-Ground Rules

Documentation is part of the live workflow, not an after-action cleanup item. The following principles govern Symphony development and must be preserved by all foremen and workers.

### 1. Canonical Reference Mapping
- The canonical approval-boundary table is `../JULES_MIDDLEMAN_OPERATING_SPEC.md#approval-boundaries`.
- The canonical workflow-phase table is `../JULES_MIDDLEMAN_OPERATING_SPEC.md#workflow-phases`.
- For the active spell Phase 1 track, the operator has allowed assumed approvals at each phase boundary.
- Every assumed approval must be logged in `SPELL_PHASE_1_ASSUMED_APPROVAL_DECISIONS.md` listing the decision point, options, decision made by the agent, rationale, and mutation performed or skipped.

### 2. Git & Verification Discipline
- Do not gitignore contract verifiers.
- Files matching `conductor/symphony/scripts/verify-*.mjs` are durable source when they protect the Symphony workflow.
- Runtime state such as `conductor/symphony/.symphony/*`, live proof captures, visual verification images, and Jules run output should stay ignored.

### 3. Environment & Execution Guidelines
- **Task Routing**: Symphony evaluates task scope sequentially. The next proof demonstrates sequential Jules execution and not parallel local workers.
- **Jules environment setup**: Ensure the environment snapshot is verified before dispatch. The accepted Package 2 setup requires `package2_scoped_snapshot_passed`. The detailed operator instructions are kept in `SPELL_PHASE_1_JULES_ENVIRONMENT_OPERATOR_RUNBOOK.md` and the environment result in `SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`.
- **Intake Flow**: Submit `docs/tasks/spells/PACKAGE_2_SYMPHONY_TASK_DRAFT_PAYLOAD.json` to local Symphony for Package 2 Symphony task draft submission and Jules dispatch.
- **Delegation ROI ledger**: Track Codex costs conservative-first without mixing estimations into measured tokens.

### 4. Historical Reference Strategy
- ARA-6 is historical proof for the workflow rather than the current live contract target.
- Historical closeouts are fully archived. All active spell tasks align with `EARLY_GAME_SPELL_EXECUTION_PLAN.md`.

---

## Superseded Per-Task Status

The older task status logs remain as historical context:
- **Task 02, Task 03, and Task 04** status descriptions have been superseded by the completed ARA-6 and Package 2 verification runs. Refer to [02-linear-creation-proof.md](./02-linear-creation-proof.md), [03-jules-manifest-staging-proof.md](./03-jules-manifest-staging-proof.md), and [04-jules-launch-readiness-and-launch-proof.md](./04-jules-launch-readiness-and-launch-proof.md) for individual contract validations.

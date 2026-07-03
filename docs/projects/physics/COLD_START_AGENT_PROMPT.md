---
schema_version: 1
handoff_type: agent_to_agent
project: Physics System
slug: physics
status: review-required
last_updated: 2026-06-15
iteration: 3
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/physics/NORTH_STAR.md
tracker: docs/projects/physics/TRACKER.md
gaps: docs/projects/physics/GAPS.md
---
# Physics System Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-05

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/physics/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Not recorded | unknown | unknown | 2026-06-05 | Dashboard schema refresh + gap routing pass |
| 3 | Claude Opus 4.8 (Claude Code) | CLI agent | certain | 2026-06-15 | Shell-only Claude Code session on win32; executed T4 |

---BEGIN NEXT AGENT HANDOFF---
Project: Physics System
Project folder: docs/projects/physics
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/physics/NORTH_STAR.md
Tracker: docs/projects/physics/TRACKER.md
Gaps: docs/projects/physics/GAPS.md

## Previous Agent Handoff

Iteration 3 (2026-06-15) completed T4: the damage half of G2. Damage elements
now map to elemental states (`DamageTypeToStateTag` / `getStateTagForDamageType`
in `src/types/elemental.ts`) and `DamageCommand.applyElementalState` resolves
them against the target's `stateTags` via `applyStateToTags` (Step 5b). Proof:
26 scoped Vitest tests pass, including a new Wet + Cold damage -> Frozen case.
See `AUDIT_OR_PROOF.md` (2026-06-15 row). G2 remains open because the
status-condition path is not wired yet (now tracked as T5).

## Current Mission

Active task:
T5 - Wire elemental state mapping into `StatusConditionCommand`
(condition name -> StateTag, e.g. 'Ignited' -> Burning), completing the second
half of G2. Resolve the resulting state through `applyStateToTags`.

Acceptance criteria:
Use the active TRACKER.md T5 row. Done when condition-to-state mapping exists in
`StatusConditionCommand`, the elemental follow-up item at line ~147 is
addressed, a regression test covers at least one condition that maps to a
StateTag, and the handoff records the proof source. If T5 is blocked, record the
blocker and pick the next actionable item (G3 tile-effect schema unify is the
next in-scope candidate; G7 stays blocked on human decision).

Key files to touch:
- docs/projects/physics/NORTH_STAR.md
- docs/projects/physics/TRACKER.md
- docs/projects/physics/GAPS.md
- docs/projects/physics/COLD_START_AGENT_PROMPT.md
- docs/projects/physics/AUDIT_OR_PROOF.md
- src/commands/effects/StatusConditionCommand.ts
- src/systems/physics/ElementalInteractionSystem.ts
- src/types/elemental.ts

Optional docs to check when present or named by tracker:
- DECISIONS.md, RUNBOOK.md
- tasks/, architecture/migration/proof notes

Scoped verification:
Targeted Vitest for the status-condition elemental path, e.g.
`npx vitest run src/commands/effects/__tests__/StatusConditionCommand.test.ts
src/commands/effects/__tests__/DamageCommand.test.ts`.

Blocking dependencies / do-not-touch:
Stay inside this project's scope. G7 (suffocation) is blocked on a human
decision (see NORTH_STAR Required Review Brief) - do not implement it. Route
sibling-project blockers instead of editing their docs.

Recent progress:
G2 damage path wired and verified (T4). G1, G3, G4, G5, G6, G8 remain as
previously recorded; see GAPS.md.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.

Final response must report:
- files updated
- files intentionally not updated
- verification performed or skipped
- bounded gap sweep surfaces checked
- project gaps recorded
- workflow gaps read or updated
- dashboard schema fields updated
- required docs accounted for
- optional docs touched, skipped, or not present
- documentation compaction performed or not needed
- agent comments added or intentionally left empty
- assumptions made
- next safe resume action
---END NEXT AGENT HANDOFF---

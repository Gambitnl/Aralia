---
schema_version: 1
handoff_type: agent_to_agent
project: Crime UI
slug: crime-ui
status: complete_for_current_gap_set
last_updated: 2026-06-25
iteration: 5
source_agent: Codex
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/crime-ui/NORTH_STAR.md
tracker: docs/projects/crime-ui/TRACKER.md
gaps: docs/projects/crime-ui/GAPS.md
agent_comments: ""
---
# Crime UI Cold Start Agent Handoff

Status: complete_for_current_gap_set
Last updated: 2026-06-25

This file is the project-specific context package and directive checklist for
the next cold-start agent. Follow the shared workflow file and use this file for
current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/crime-ui/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Qoder | application agent | inferred | 2026-06-15 | IDE-integrated agent context |
| 3 | Gemini CLI | application agent | certain | 2026-06-17 | Explicit identification in prior session |
| 4 | Gemini CLI | application agent | certain | 2026-06-17 | Resolved G3 and G4 implementation gaps |
| 5 | Codex | application agent | certain | 2026-06-25 | Reconciled G1-G5 against current source and Crime core closeout |

---BEGIN NEXT AGENT HANDOFF---
Project: Crime UI
Project folder: docs/projects/crime-ui
iteration: 6
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/crime-ui/NORTH_STAR.md
Tracker: docs/projects/crime-ui/TRACKER.md
Gaps: docs/projects/crime-ui/GAPS.md

## Previous Agent Handoff

Iteration 5 (2026-06-25, Codex, application agent): closed the current Crime UI
gap set. G1 is answered by Crime core G6: suspect/report aggregate types are
deferred until a real caller needs structured reports. G2 is resolved by the
dedicated `SELL_FENCED_ITEM` fence transaction path. G3 and G4 were already
implemented and were rechecked against source. G5 is resolved by documenting the
modal lifecycle rules for guild, safehouse, and heist planning surfaces in
`GAPS.md`.

## Current Mission

Active task:
None in the current Crime UI gap set. T2-T4 and G1-G5 are complete.

Acceptance criteria:
Before assigning more Crime UI work, run a fresh source-backed scan and add a
new gap only when current source evidence supports it.

Key files to inspect before any new slice:
- docs/projects/crime-ui/NORTH_STAR.md
- docs/projects/crime-ui/TRACKER.md
- docs/projects/crime-ui/GAPS.md
- docs/projects/crime/NORTH_STAR.md
- docs/projects/crime/GAPS.md
- src/components/Crime/ThievesGuild/FenceInterface.tsx
- src/components/Crime/ThievesGuild/HeistPlanningModal.tsx
- src/components/Crime/ThievesGuild/ThievesGuildSafehouse.tsx
- src/state/reducers/uiReducer.ts
- src/components/layout/GameModals.tsx

Scoped verification:
For docs-only scans, run the living-project audit. For UI code changes, run the
focused component tests and use rendered inspection if visual behavior changes.

Blockers / boundaries:
Do not introduce suspect/report schema or new crime-core behavior from this UI
project without a concrete caller and a cross-check against `docs/projects/crime`.

Recent progress:
`TRACKER.md` is compacted to one current gap log. `GAPS.md` records zero open
gaps and includes the modal lifecycle rule table. `AUDIT_OR_PROOF.md` records
the T4/G1-G5 closeout evidence.

## Required End State For This Iteration

Before ending a future iteration, update this handoff with the next iteration
number, previous agent context, active task, acceptance criteria, key files,
verification method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Account for every required doc, mention optional docs
touched or skipped, update `agent_comments` only when an out-of-flow note is
useful, and keep only the current handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---

---
schema_version: 1
handoff_type: agent_to_agent
project: Design Preview
slug: design-preview
status: idle
last_updated: 2026-06-22
iteration: 9
source_agent: Codex
target_agent: next cold-start agent
runtime_surface: desktop app
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/design-preview/NORTH_STAR.md
tracker: docs/projects/design-preview/TRACKER.md
gaps: docs/projects/design-preview/GAPS.md
---
# Design Preview Cold Start Agent Handoff

status: idle
Last updated: 2026-06-22
This file is the project-specific context package and directive checklist for
the next cold-start agent. It does not duplicate the full workflow rules. The
agent must follow the shared workflow file and use this file for current
project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/design-preview/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Design Preview
Project folder: docs/projects/design-preview
Iteration: 9
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/design-preview/NORTH_STAR.md
Tracker: docs/projects/design-preview/TRACKER.md
Gaps: docs/projects/design-preview/GAPS.md
Runbook: docs/projects/design-preview/RUNBOOK.md
Audit/proof: docs/projects/design-preview/AUDIT_OR_PROOF.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Gemini CLI | CLI agent | certain | 2026-06-08 | T2 closure, self-contained workflow update |
| 6 | gpt-5.4-mini high | CLI agent | certain | 2026-06-09 | Source-backed lane steward map, split-readiness proof gates, and G1/G3/G4 closure |
| 7 | Gemini CLI | CLI agent | certain | 2026-06-10 | Routine docs consistency verification and handoff update |
| 8 | Codex | desktop app | certain | 2026-06-22 | Tactical Sandbox scenarios routed into `docs/projects/design-preview-scenarios` parent/subproject docs |

## Previous Agent Handoff

Iteration 8 created `docs/projects/design-preview-scenarios` as the parent-with-subprojects route for the Tactical Sandbox / Combat Scenarios lane. The broad Design Preview project remains the steward for the whole preview tool, while scenario-specific work now starts from the scenario parent and its child packets.

## Current Mission

Active task:
None for the broad Design Preview project.

Scenario-specific active work should be selected from:
`docs/projects/design-preview-scenarios/SUBPROJECTS.md`

Acceptance criteria:
The project is in a steady documented state. The next agent should preserve the source-backed lane steward map, keep the split-readiness proof anchors current, and route Tactical Sandbox scenario work through the new scenario parent.

Key files to touch:
- docs/projects/design-preview/NORTH_STAR.md
- docs/projects/design-preview/TRACKER.md
- docs/projects/design-preview/GAPS.md
- docs/projects/design-preview/COLD_START_AGENT_PROMPT.md
- docs/projects/design-preview/RUNBOOK.md
- docs/projects/design-preview/AUDIT_OR_PROOF.md
- docs/projects/design-preview-scenarios/NORTH_STAR.md when the task is scenario-specific
- docs/projects/design-preview-scenarios/SUBPROJECTS.md when the task is scenario-specific

Optional docs to check when present or named by tracker:
- DECISIONS.md
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
- `git diff --check` for all touched files, including any new file.
- `npm run projects:audit` and a Design Preview row check to confirm the registry still points at this project folder.
- Visual checks using `RUNBOOK.md` only if broad preview runtime or styling features are added later. Scenario visual checks should use the scenario parent runbook and `misc/design.html?step=scenarios`.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not implement large new lanes without a registered task or explicitly updating the scope in `NORTH_STAR.md`. Do not collapse the scenario child packets back into this broad tracker.

Recent progress:
T2 is closed. A self-contained cold-start resume path exists in `NORTH_STAR.md`. The manual launch and smoke checklist is maintained in `RUNBOOK.md`. The lane steward map now covers the active router, the only large helper called out as dormant is `PreviewMdLibrary.tsx`, and the scenarios lane now points to `docs/projects/design-preview-scenarios`.

Workflow gaps reviewed:
Checked `GLOBAL_GAPS.md` and the living-project protocol while creating the scenario parent. No global gap was imported into Design Preview.

Dashboard schema updates:
`gap_signal` now reads as 0 open gaps with the scenario parent route noted. `next_step` now points at maintaining the lane steward map and routing Tactical Sandbox scenario work through `docs/projects/design-preview-scenarios`.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Account for every required doc, mention optional docs
touched or skipped, update `agent_comments` only when an out-of-flow note is
useful, and keep only the current handoff between the same BEGIN/END markers;
do not preserve old handoff transcripts in this file.

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

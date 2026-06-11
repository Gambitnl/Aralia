---
schema_version: 1
handoff_type: agent_to_agent
project: 3D Combat Map
slug: 3d-combat-map
status: active
last_updated: "2026-06-09"
iteration: 7
source_agent: Bernoulli / gpt-5.4-mini high
target_agent: next cold-start agent
runtime_surface: "MCP-subagent + headless runtime proof"
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/3d-combat-map/NORTH_STAR.md
tracker: docs/projects/3d-combat-map/TRACKER.md
gaps: docs/projects/3d-combat-map/GAPS.md
---
# 3D Combat Map Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/3d-combat-map/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: 3D Combat Map
Project folder: docs/projects/3d-combat-map
Iteration: 7
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/3d-combat-map/NORTH_STAR.md
Tracker: docs/projects/3d-combat-map/TRACKER.md
Gaps: docs/projects/3d-combat-map/GAPS.md
Audit/proof: docs/projects/3d-combat-map/AUDIT_OR_PROOF.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed after Bernoulli closed G6 with a focused terrain-shader pass and verified the 3D Combat Map row in the living-project audit.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 6 | McClintock / gpt-5.4-mini high | MCP-subagent + browser | certain | 2026-06-09 | Live browser slope-click proof closed G4 and kept NC2/G7 open. |
| 7 | Bernoulli / gpt-5.4-mini high | MCP-subagent + headless runtime proof | certain | 2026-06-09 | Terrain shader warning closed in `TerrainMesh.tsx`; targeted console sweep found no `f_getTerrainColor` / `X4000` messages; living-project audit returned `schema_status: valid` for 3D Combat Map. |

## Current Mission

Active task:
Unblock NC2 (G7) so the CombatView-hosted proof can run, or record a refined blocker if the reach path still cannot be made available. Do not expand into World3D or combat-rule changes.

Acceptance criteria:
- Reach a real combat encounter in `CombatView`.
- Toggle 3D, confirm `BattleMap3D` mounts, then pop out -> interact -> return and confirm `renderMode` stays `3d`, turn order and selected token persist, and the 2D/3D toggle still works.
- If combat cannot be reached, document the blocker in `docs/projects/3d-combat-map/GAPS.md` and `docs/projects/3d-combat-map/AUDIT_OR_PROOF.md` instead of widening scope.
- Keep the G6 shader warning closed; do not reopen it unless the terrain shader logic changes again.

Key files to touch:
- docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- src/components/Combat/CombatView.tsx
- .agent/3d-visual-quality/captures/nc2-combatview.mjs

Scoped verification:
Use the reusable headless capture harness on port 5174, then run `npm run projects:audit` and `git diff --check`. If the shared in-app browser profile is busy again, use the existing headless capture path and record that alternate harness route.

Blocking dependencies / do-not-touch:
Stay inside combat-only scope. Do not absorb World3D or ThreeDModal behavior. Do not change combat rules.

Recent progress:
T1-T5 done. G2, G4, and G6 are closed. G3, G5, and G7 remain open.

Workflow gap review:
WFG-001 is resolved; the canonical workflow and schema paths are already in use, so no +1 was added.

Dashboard schema update:
The 3D Combat Map row is schema_status: valid with missing_schema_fields: [] and missing_required_docs: [].

Required End State For This Iteration:
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

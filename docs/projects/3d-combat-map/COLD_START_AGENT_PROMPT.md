---
schema_version: 1
handoff_type: agent_to_agent
project: 3D Combat Map
slug: 3d-combat-map
status: active
last_updated: 2026-06-11
iteration: 8
source_agent: Codex / GPT-5
target_agent: next cold-start agent
runtime_surface: "Codex desktop app + local PowerShell + headless Playwright proof"
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
Last updated: 2026-06-11

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
iteration: 8
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/3d-combat-map/NORTH_STAR.md
Tracker: docs/projects/3d-combat-map/TRACKER.md
Gaps: docs/projects/3d-combat-map/GAPS.md
Audit/proof: docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
Optional split handoff: docs/projects/3d-combat-map/HANDOFF.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed after Codex / GPT-5 closed NC2, G3, and G7 with a headless CombatView pop-out lifecycle proof through `?dev_combat=1`.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 6 | McClintock / gpt-5.4-mini high | MCP-subagent + browser | certain | 2026-06-09 | Live browser slope-click proof closed G4 and kept NC2/G7 open. |
| 7 | Bernoulli / gpt-5.4-mini high | MCP-subagent + headless runtime proof | certain | 2026-06-09 | Terrain shader warning closed in `TerrainMesh.tsx`; targeted console sweep found no `f_getTerrainColor` / `X4000` messages; living-project audit returned `schema_status: valid` for 3D Combat Map. |
| 8 | Codex / GPT-5 | Codex desktop app + local PowerShell + headless Playwright proof | certain | 2026-06-11 | `?dev_combat=1` reached CombatView; NC2 passed with inline/pop-out 3D canvases, `renderMode=3d` after return, persisted turn order and inspected token `Satum`, toggle health, and zero captured console errors. |

## Current Mission

Active task:
Run the G11 targeting-decal saved-PNG proof from `HANDOFF.md` and `.agent/3d-visual-quality/TRACKER.md` rows 257-258. Do not reopen NC2/G3/G7 unless the CombatView pop-out path regresses.

Acceptance criteria:
- Use the combat-only path: `?dev_combat=1` plus Continue Journey, then switch CombatView to 3D.
- Select Satum or another player character with a ranged/AoE targeting ability such as Acid Splash.
- Capture durable before/after 3D screenshots that show whether `TargetingDecals.tsx` paints valid target or teleport tile sets into the 3D canvas.
- Record console health for the capture window, especially repeated WebGL/postprocessing errors.
- Update `GAPS.md`, `TRACKER.md`, `AUDIT_OR_PROOF.md`, and this handoff with artifact paths and pass/fail status.
- Stay inside battle-map targeting proof. Do not absorb Worldforge, World3D, ThreeDModal, or combat-rule changes.

Key files likely to touch:
- docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- .agent/3d-visual-quality/TRACKER.md
- .agent/3d-visual-quality/captures/shoot.mjs or a narrow proof harness
- src/components/BattleMap/TargetingDecals.tsx only if the proof exposes a real defect

Scoped verification:
Use the reusable headless capture route on port 5174. For doc-only proof updates, run `npm run projects:audit` and `git diff --check`. If code changes, use focused tests for the touched battle-map surface and follow `AGENTS.md` dependency-sync rules for exported signature changes.

Blocking dependencies / do-not-touch:
Stay inside combat-only scope. Do not absorb Worldforge, World3D, ThreeDModal behavior, or combat-rule changes. Keep the G6 shader warning and NC2 proof closed unless the terrain shader or CombatView pop-out logic changes again.

Recent progress:
T1-T5 done. G2, G3, G4, G6, G7, and G8 are closed. NC1 and NC2 are complete. G5, G9, G10, G11, and G12 remain open. G11 and G12 were imported during the bounded gap sweep from `.agent/3d-visual-quality` because the 2026-06-11 split handoff already names them as current 3D battle-map follow-ups.

Workflow gap review:
`WORKFLOW_GAPS.md` was read on 2026-06-11. No active workflow gaps were present, and no +1 or new workflow gap was added.

Dashboard schema update:
`NORTH_STAR.md` frontmatter was updated on 2026-06-11: confidence high, gap signal 5 open gaps, last proof 2026-06-11, workflow gaps reviewed 2026-06-11, completed verification includes `nc2_popout_lifecycle`, and `agent_comments` remains empty.

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

## Project Prompt Conformance Notes

Last updated: 2026-06-11

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_decisions_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original 3d-combat-map handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- docs/projects/3d-combat-map/DECISIONS.md
- docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
- docs/projects/3d-combat-map/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.

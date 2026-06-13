---
schema_version: 1
handoff_type: agent_to_agent
project: Submap Generation
slug: submap-generation
Status: merged-reference
last_updated: 2026-06-12
iteration: 4
source_agent: Codex / gpt-5
target_agent: next cold-start agent
runtime_surface: direct dashboard correction pass
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/submap-generation/NORTH_STAR.md
tracker: docs/projects/submap-generation/TRACKER.md
gaps: docs/projects/submap-generation/GAPS.md
---
# Submap Generation Cold Start Agent Handoff

Status: merged-reference
Last updated: 2026-06-12

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 4 | Lovelace / gpt-5.4-mini high | MCP-subagent docs-only contract pass | certain | 2026-06-09 | Source-backed contract refresh closed G2/G3 and opened the adjacency-thread G4 follow-up. |
| 5 | Codex / gpt-5 | direct dashboard correction pass | certain | 2026-06-09 | User clarified Submap is active pre-deprecation extraction; Submap Generation routes to Submap G4/G5. |

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/submap-generation/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Submap Generation
Project folder: docs/projects/submap-generation
iteration: 4
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/submap-generation/NORTH_STAR.md
Tracker: docs/projects/submap-generation/TRACKER.md
Gaps: docs/projects/submap-generation/GAPS.md

## Previous Agent Handoff

This pass documented the live submap-generation contract from source evidence.
The project is now merged-reference after user clarification on 2026-06-09.
Active generation extraction belongs to `docs/projects/submap/` G4.

## Current Mission

Active task:
Do not assign this project separately. Continue through `docs/projects/submap/`
G4 for generation extraction or G5 for final replacement questions.

Acceptance criteria:
Use the source-backed contract snapshot in `NORTH_STAR.md` as extraction
evidence. Keep this packet aligned with Submap G4/G5 routing.

Key files to touch:
- docs/projects/submap-generation/NORTH_STAR.md
- docs/projects/submap-generation/TRACKER.md
- docs/projects/submap-generation/GAPS.md
- docs/projects/submap-generation/AUDIT_OR_PROOF.md
- docs/projects/submap-generation/DECISIONS.md
- docs/projects/submap-generation/RUNBOOK.md
- docs/projects/submap-generation/COLD_START_AGENT_PROMPT.md

Scoped verification:
Run `node scripts/audit-living-project-docs.cjs` and `git diff --check`.
Report the `submap-generation` row and any missing-doc warnings that remain.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not assign this project
separately. Active work should be sent to `docs/projects/submap/` extraction
rows and must not delete systems.

Recent progress:
The live contract now names the hook inputs, outputs, consumers, and layering
rules. The feature folder is treated as merged-reference evidence for Submap G4.
agent_comments: User clarification on 2026-06-09 routes this lane into the active Submap pre-deprecation extraction project.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, the current
task, acceptance criteria, key files, verification method, blockers, recent
progress, workflow-gap review result, and dashboard-schema updates. Keep only
the current handoff between the markers and do not preserve old transcripts in
this file.

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

Last updated: 2026-06-12

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_iteration_ledger.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original submap-generation handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/submap-generation/NORTH_STAR.md
- docs/projects/submap-generation/TRACKER.md
- docs/projects/submap-generation/GAPS.md
- docs/projects/submap-generation/COLD_START_AGENT_PROMPT.md
- docs/projects/submap-generation/DECISIONS.md
- docs/projects/submap-generation/AUDIT_OR_PROOF.md
- docs/projects/submap-generation/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.

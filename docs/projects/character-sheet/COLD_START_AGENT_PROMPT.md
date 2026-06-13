---
schema_version: 1
handoff_type: agent_to_agent
project: Character Sheet
slug: character-sheet
Status: active
last_updated: 2026-06-12
iteration: 10
source_agent: Gemini 3.5 Flash
target_agent: next cold-start agent
runtime_surface: MCP-subagent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/character-sheet/NORTH_STAR.md
tracker: docs/projects/character-sheet/TRACKER.md
gaps: docs/projects/character-sheet/GAPS.md
---
# Character Sheet Cold Start Agent Handoff

Status: active
Last updated: 2026-06-12

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/character-sheet/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Character Sheet
Project folder: docs/projects/character-sheet
iteration: 10
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/character-sheet/NORTH_STAR.md
Tracker: docs/projects/character-sheet/TRACKER.md
Gaps: docs/projects/character-sheet/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 9 | Gemini 3.5 Flash | MCP-subagent | certain | 2026-06-08 | Audited InventoryList, characterUtils, and registered G8, G9, G10 project gaps. |
| 8 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Codex desktop app context with shell-based source inspection and docs update pass |
| 7 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Fallback from gpt-5.3-codex-spark after usage limit hit until 9:03 PM on 2026-06-08 |
| 6 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark was at usage limit |
| 5 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark was at usage limit |
| 4 | gpt-5.3-codex-spark high | MCP-subagent | certain | 2026-06-08 | Normalized Character Sheet item action contract to `USE_ITEM` and verified reducer/action-message tests |

## Previous Agent Handoff

Iteration 9 completed a detailed codebase audit of `InventoryList.tsx`, `characterUtils.ts`, and associated data types. G7 remains review-required because the human decision on food decay/expiration timestamp semantics is pending. Newly identified gaps G8 (heavy armor speed warning), G9 (slotless equippable items), and G10 (transient container assignments) have been registered in `GAPS.md` and `TRACKER.md`.

## Current Mission

Active task:
G7 - Food decay / expiration review in `InventoryList.tsx` is review-required until a durable timestamp source is approved.

Acceptance criteria:
- Source-read the Inventory surface, its data dependencies, and any related call sites.
- Record the Required Review Brief in the project docs and mark the project review-required.
- Preserve the current runtime; do not invent a save-time or acquisition-time system without a decision.

Key files to touch:
- docs/projects/character-sheet/GAPS.md
- docs/projects/character-sheet/NORTH_STAR.md
- docs/projects/character-sheet/TRACKER.md
- docs/projects/character-sheet/COLD_START_AGENT_PROMPT.md
- src/components/CharacterSheet/Overview/InventoryList.tsx
- src/types/items.ts
- src/types/provenance.ts
- src/data/item_templates/index.ts

Scoped verification:
Docs/source consistency check for the Inventory expiration contract plus `git diff --check` on touched files. No focused render test until a decision approves a timestamp source.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not continue into implementation until the Required Review Brief decision is recorded.

Required-review handling:
The project is already review-required. The Required Review Brief now lives in `docs/projects/character-sheet/NORTH_STAR.md` and captures the decision question, current behavior, blocked reason, options, evidence, decision owner, and proof-after-decision. Do not assign forward implementation agents until the decision is recorded.

Recent progress:
T4 completed and documented. G3 and G6 are resolved with focused render proof. G7 remains explicitly blocked on a human decision because the food freshness placeholder in `InventoryList.tsx` lacks a durable timestamp source. Added G8, G9, and G10 gaps.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers. Keep the iteration agent ledger as one compact row per completed iteration; do not preserve old handoff transcripts in this file.
Required docs to account for before closeout:
- NORTH_STAR.md
- TRACKER.md
- GAPS.md
- COLD_START_AGENT_PROMPT.md
- DECISIONS.md
- AUDIT_OR_PROOF.md
- RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-12

This section aligns older cold-start prompts with the shared living-project workflow without replacing the project-specific handoff above. The original handoff remains authoritative for project context; this section records the universal prompt shape that every next agent must honor.

Conformance issues repaired on 2026-06-12: missing_decisions_reference, missing_proof_reference, missing_runbook_reference.

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md

Agent identity / runtime:
Before selecting work, identify yourself and the surface you are running through. Use one of: CLI agent, application agent, browser/app-embedded agent, MCP/subagent, or unknown. Mark the classification as certain, inferred, or unknown and name the clue used.

### Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original character-sheet handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/character-sheet/NORTH_STAR.md
- docs/projects/character-sheet/TRACKER.md
- docs/projects/character-sheet/GAPS.md
- docs/projects/character-sheet/COLD_START_AGENT_PROMPT.md
- docs/projects/character-sheet/DECISIONS.md
- docs/projects/character-sheet/AUDIT_OR_PROOF.md
- docs/projects/character-sheet/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.

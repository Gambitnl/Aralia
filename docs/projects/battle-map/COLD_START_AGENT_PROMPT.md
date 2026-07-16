---
schema_version: 1
handoff_type: agent_to_agent
project: Battle Map
slug: battle-map
status: active
last_updated: 2026-07-15
iteration: 9
source_agent: Codex desktop
target_agent: next cold-start agent
runtime_surface: application agent
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/battle-map/NORTH_STAR.md
tracker: docs/projects/battle-map/TRACKER.md
gaps: docs/projects/battle-map/GAPS.md
---
# Battle Map Cold Start Agent Handoff

Status: active
Last updated: 2026-07-15

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/battle-map/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Battle Map
Project folder: docs/projects/battle-map
iteration: 9
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/battle-map/NORTH_STAR.md
Tracker: docs/projects/battle-map/TRACKER.md
Gaps: docs/projects/battle-map/GAPS.md
Production source inventory: docs/projects/battle-map/WORLDFORGE_SOURCE_INVENTORY.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | gpt-5.3-codex-spark high | MCP-subagent | certain | 2026-06-08 | Documented Battle Map map-state/events sync contract; no runtime files changed |
| 4 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark was at usage limit until 2026-06-08 21:03 |
| 5 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback because gpt-5.3-codex-spark remained over limit |
| 6 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Fallback while gpt-5.3-codex-spark remained over limit; documented the hook-shaped filename contract without renaming callers |
| 7 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Built the 2D/3D parity checklist and focused renderer proof, corrected stale tile selectors, and added the safe 3D lighting guard |
| 8 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker; elevated the Battle Map naming contract to review-required and added the Required Review Brief |
| 9 | Codex desktop | application agent | certain | 2026-07-15 | Established the global WorldForge-only production boundary, audited tactical launchers, and migrated road-backed land travel through the real combat shell with rendered proof |

## Previous Agent Handoff

Iteration 9 changed the product boundary rather than merely the painter. Production `CombatView` now requires an extracted WorldForge map or fails closed; the legacy generator remains only in labeled developer sandboxes. The production inventory audits every known launcher. Ground hostile proximity, generated-settlement watch, generated-state patrols, and road-backed land travel are source-backed. The road-travel handoff rebuilds the exact destination GroundWorld from saved seed/time/deltas, selects a real source road, and uses the normal action/reducer/combat shell. Hostile openings, static authored-town watch, sea encounters, and location-free simulation remain visible source gaps. The older naming and renderer-modularization gaps remain preserved but are not the active objective.

## Current Mission

Active task:
T-WF-OPENING / G8 - trace hostile-opening attacks and failed de-escalations to an exact canonical WorldForge spawn cell/site before tactical transition.

Acceptance criteria:
The opening situation either supplies deterministic World -> Region -> Local -> Ground -> Tactical provenance and rendered production-shell proof, or remains visibly withheld. It must never acquire procedural terrain or a generic center crop. Update the source inventory, tracker, gap registry, Plan Map, focused tests, and adversarial screenshot notes after the slice.

Key files to touch:
- docs/projects/battle-map/WORLDFORGE_SOURCE_INVENTORY.md
- docs/projects/battle-map/NORTH_STAR.md
- docs/projects/battle-map/TRACKER.md
- docs/projects/battle-map/GAPS.md
- docs/projects/battle-map/COLD_START_AGENT_PROMPT.md
- docs/projects/battle-map/AUDIT_OR_PROOF.md
- the opening/de-escalation launcher after its canonical source receipt is traced
- src/App.tsx only if it owns that exact transition

Scoped verification:
Focused source-receipt, projection, encounter-launcher, reducer, and `CombatView` tests; rendered production-shell inspection at representative desktop and narrower/taller viewports; touched-file ESLint and TypeScript diagnostic filter; docs consistency plus `git diff --check`.

Blocking dependencies / do-not-touch:
Do not substitute an atlas-cell center, procedural arena, or lab-authored map when the opening receipt cannot prove a canonical location. Do not absorb repo-wide TypeScript debt, unrelated cleanup, or Atlas navigation into this workstream. Preserve the older `useBattleMapGeneration.ts` naming decision and renderer parity gates while this production-authority goal proceeds.

Required-review handling:
If this iteration discovers a human/product/policy blocker, mark the project review-required only after creating or refreshing a `Required Review Brief` in `NORTH_STAR.md`, `TRACKER.md`, or `GAPS.md`. That brief is the project-detail visual decision segment; include the decision question, issue, current behavior, blocked reason, options, evidence, decision owner, and proof-after-decision. Once marked review-required, do not assign forward implementation agents until the decision is recorded.

Recent progress:
The global authority boundary and source-gap screen are rendered and covered. The production source inventory is current. Road-backed land travel is the fourth migrated class and is proved by 61/61 focused tests plus 1600x1000 and 1353x1272 production-shell captures; roadless destinations are deliberately withheld and the sea-event route has its own focused withholding proof. G8-G11 route the remaining production source gaps. The Plan Map records the authority boundary, travel migration, and hostile-opening next slice. Repository TypeScript remains a separate debt surface; touched battlefield/travel files produced no diagnostic.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers. Keep the iteration agent ledger as one compact row per completed iteration; do not preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---

## Project Prompt Conformance Notes

Last updated: 2026-06-10

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
| pre-standardization | not recorded | unknown | unknown | before 2026-06-12 | Original battle-map handoff predates the ledger requirement. |

### Required project docs to account for

- docs/projects/battle-map/NORTH_STAR.md
- docs/projects/battle-map/TRACKER.md
- docs/projects/battle-map/GAPS.md
- docs/projects/battle-map/COLD_START_AGENT_PROMPT.md
- docs/projects/battle-map/DECISIONS.md
- docs/projects/battle-map/AUDIT_OR_PROOF.md
- docs/projects/battle-map/RUNBOOK.md

Closeout reminder:
Before ending an iteration, refresh or explicitly report on every required project doc above. If a supporting doc is not relevant to the current slice, say why instead of silently ignoring it.

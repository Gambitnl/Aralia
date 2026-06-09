# Creatures System Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/creatures/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Creatures System
Project folder: docs/projects/creatures
Iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/creatures/NORTH_STAR.md
Tracker: docs/projects/creatures/TRACKER.md
Gaps: docs/projects/creatures/GAPS.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed from a Codex desktop foreman review after MCP
subagent Parfit completed the CT-2/G1 validator-sharing pass, and iteration 4
closed G5 with source-backed corpus proof.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Parfit / gpt-5.3-codex-spark high | MCP/subagent | certain | 2026-06-08 | Subagent completion notification `019ea7ba-d0b6-7831-84a4-828e7b1f750c` |
| 4 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

## Previous Agent Handoff

The iteration-1 docs refresh pass completed on 2026-06-05. The 2026-06-08
schema-policy pass completed CT-3: new targeting-filter writes use plural fields
(`creatureTypes`, `sizes`, `alignments`, `excludeCreatureTypes`), while singular
aliases (`creatureType`, `size`, `alignment`) stay as read-only compatibility
inputs until a later corpus migration. Iteration 3 completed CT-2/G1: both
spell targeting and manual combat validation now share `CreatureTaxonomy`
include/exclude semantics while preserving legacy reads. Iteration 4 resolved
G5 by proving the monster corpus is generator-owned: `scripts/ingestMonsters.ts`
writes `src/data/monsters.generated.ts`, `src/data/monsters.ts` re-exports it,
and the generated corpus stays intact for future expansion.

## Current Mission

Active task:
G4 adjacent follow-up only; G5 is complete and documented with source-backed proof.

Acceptance criteria (remaining):
CT-2 completed and validated: both validators share `CreatureTaxonomy`, including legacy alias reads and focused include/exclude test coverage.
G5 completed with source-backed corpus proof. G4 remains adjacent and documentation-only for this pass.

Key files to touch:
- docs/projects/creatures/NORTH_STAR.md
- docs/projects/creatures/TRACKER.md
- docs/projects/creatures/GAPS.md
- docs/projects/creatures/AUDIT_OR_PROOF.md
- docs/projects/creatures/COLD_START_AGENT_PROMPT.md

Optional docs to check when present or named by tracker:
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- architecture notes or migration notes that explicitly discuss spell targeting

Scoped verification:
Run `git diff --check` for the touched docs. Source review only was needed for
G5; run focused tests for `CreatureTaxonomy`, `TargetValidationUtils`, and
`useTargetValidator` only if those files are touched in a future pass.

Blocking dependencies / do-not-touch:
Do not delete legacy schema aliases, rewrite the spell corpus, or implement
hybrid/multi-type semantics in this slice. Keep the monster corpus generator-owned
and do not manually split or delete generated creature data. Route broader
spell-corpus migration or hybrid semantics to project gaps instead of expanding
CT-2.

Recent progress:
G2/CT-3 and G1/CT-2 are complete. G5 is now resolved through the creature
audit/proof doc. G4 hybrid semantics remains the adjacent follow-up.

Workflow-gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read;
no new workflow-level ambiguity was added or updated in this pass.

Dashboard-schema updates:
`NORTH_STAR.md` now carries the schema frontmatter and refreshed
`gap_signal`, `next_step`, `required_verification`, `completed_verification`,
`last_proof`, `workflow_gaps_reviewed`, and `agent_comments` fields.

Blockers:
None for G5. G4 still needs product direction before any implementation work.

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

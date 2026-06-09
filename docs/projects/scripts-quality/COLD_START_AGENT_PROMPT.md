# Scripts: Quality Cold Start Agent Handoff

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
docs/projects/scripts-quality/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

---BEGIN NEXT AGENT HANDOFF---
Project: Scripts: Quality
Project folder: docs/projects/scripts-quality
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/scripts-quality/NORTH_STAR.md
Tracker: docs/projects/scripts-quality/TRACKER.md
Gaps: docs/projects/scripts-quality/GAPS.md

## Previous Agent Handoff

Iteration 2 kept the quality-debt checkpoint convention in place and made the remaining cadence/policy follow-up explicit as a routed scripts-git item.

## Current Mission

Active task:
Preserve the scripts-quality checkpoint convention and keep the routed scripts-git cadence follow-up outside this project unless ownership changes.

Acceptance criteria:
The current tracker and gap log stay internally consistent, the dashboard schema still shows one routed adjacent follow-up, and no local policy or human-review gate is opened.

Blockers:
None. The remaining follow-up is routed to scripts-git and this slice stays docs-only.

Key files to touch:
- docs/projects/scripts-quality/NORTH_STAR.md
- docs/projects/scripts-quality/TRACKER.md
- docs/projects/scripts-quality/GAPS.md
- docs/projects/scripts-quality/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task

Scoped verification:
Run `npm run quality:debt` on any quality-scope change and compare the output shape to the `scripts/quality/debt-summary.cjs` map.

Workflow-gap review result:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was reviewed; the stale-path workflow gap remains open, and no new workflow-level gap was needed for this slice.

Dashboard schema updates:
The `Gap signal` entry now names the routed scripts-git follow-up explicitly so the dashboard does not read it as a local scripts-quality task.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of editing their docs.

Recent progress:
The North Star now records the checkpoint convention, the tracker marks the routed follow-up as cross-project, and the gap log keeps G3 explicitly owned by scripts-git instead of scripts-quality.

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

# Glossary UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-06

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/glossary-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Glossary UI
Project folder: docs/projects/glossary-ui
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/glossary-ui/NORTH_STAR.md
Tracker: docs/projects/glossary-ui/TRACKER.md
Gaps: docs/projects/glossary-ui/GAPS.md

## Previous Agent Handoff

Iteration 1 created the initial glossary-ui cold-start packet and established
the active T2/T3 queue. This pass refreshed the project docs so the next agent
can resume T2 without re-deriving the dashboard schema or the gap list.

## Current Mission

Active task:
T2 - Capture non-dev glossary rebuild contract as a stable project-level check

Acceptance criteria:
- NORTH_STAR.md includes the dashboard card schema and current focus.
- TRACKER.md names the non-dev refresh command and proof artifact clearly.
- GAPS.md keeps the rebuild-contract blocker and adjacent assumptions evidence-backed.
- The next agent can resume from docs alone without guessing the source -> index -> bundle path.

Key files to touch:
- docs/projects/glossary-ui/NORTH_STAR.md
- docs/projects/glossary-ui/TRACKER.md
- docs/projects/glossary-ui/GAPS.md
- docs/projects/glossary-ui/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task if the work widens beyond docs

Scoped verification:
Docs-only pass. Runtime verification still belongs to the task that actually
changes source or build outputs.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers
instead of editing their docs.

Recent progress:
Dashboard Card Schema added/refreshed in NORTH_STAR.md. Tracker and gaps were
updated to make the T2 resume path explicit. No workflow-level ambiguity was
found in the shared workflow review.

Key files to touch:
- docs/projects/glossary-ui/NORTH_STAR.md
- docs/projects/glossary-ui/TRACKER.md
- docs/projects/glossary-ui/GAPS.md
- docs/projects/glossary-ui/COLD_START_AGENT_PROMPT.md
- docs/projects/glossary-ui/DECISIONS.md
- docs/projects/glossary-ui/AUDIT_OR_PROOF.md
- docs/projects/glossary-ui/RUNBOOK.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
- <source/docs named by the active tracker task>

Optional docs to check when present or named by tracker:
- tasks/
- architecture notes
- migration notes
- project-specific proof or design notes

Scoped verification:
Use the scoped verification named by TRACKER.md, NORTH_STAR.md, or the active task. If verification cannot be run, record the blocker and next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Route sibling-project blockers instead of copying them here.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, and GAPS.md as the current source of truth.

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

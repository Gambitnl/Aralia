# Glossary UI Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/glossary-ui/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Glossary UI
Project folder: docs/projects/glossary-ui
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
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

## Required End State For This Iteration

Before ending, keep the handoff current with the next iteration number,
previous agent context, active task, acceptance criteria, key files,
verification method, blockers, and recent progress. End the response with the
refreshed handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---

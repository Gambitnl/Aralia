# Providers Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
does not duplicate the workflow rules. The agent must follow the shared workflow
file and use this file only for the current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/providers/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Providers
Project folder: docs/projects/providers
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/providers/NORTH_STAR.md
Tracker: docs/projects/providers/TRACKER.md
Gaps: docs/projects/providers/GAPS.md

## Previous Agent Handoff

Iteration 1 established the initial provider doc set and dependency map.
This pass refreshed the dashboard card schema and compacted the tracker/gap
handoff so the next agent can start from the current provider state instead of
the bootstrap state.

## Current Mission

Active task:
G2 - Decide how degraded provider states should behave when some providers load and others fail

Acceptance criteria:
`G2` has a compact decision entry, `G3` stays paired in the same slice, and the
project docs stay aligned on provider order, gate behavior, and gap signal.

Key files to touch:
- docs/projects/providers/NORTH_STAR.md
- docs/projects/providers/TRACKER.md
- docs/projects/providers/GAPS.md
- docs/projects/providers/COLD_START_AGENT_PROMPT.md
- Any source/docs named by the active tracker task, only if the decision
  requires a source-doc sync

Scoped verification:
Do a docs consistency review against the current App render path and provider
order. If the slice widens to source docs, use the source evidence named by the
tracker or North Star.

Blocking dependencies / do-not-touch:
`G4` is a separate source-doc sync for `GlossaryContext.README.md`; do not
widen this doc pass into runtime refactors.

Recent progress:
Dashboard Card Schema added to NORTH_STAR.md. Tracker and gaps are now compact
enough for the next agent to continue from the live provider gap set. No
workflow-level ambiguity was found in this pass.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, and recent progress. End the response with the refreshed
handoff between the same BEGIN/END markers.
---END NEXT AGENT HANDOFF---

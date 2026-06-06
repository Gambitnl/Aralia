# Phb2024 Glossary Audit Cold Start Agent Handoff

Status: active
Last updated: 2026-06-05

This file is the project-specific handoff for the next cold-start agent. It
is intentionally compact and does not duplicate the shared workflow rules. The
agent must follow the shared workflow file and use this file only for the
current project context.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Project entry point:
docs/projects/phb2024_glossary_audit/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Phb2024 Glossary Audit
Project folder: docs/projects/phb2024_glossary_audit
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
North Star: docs/projects/phb2024_glossary_audit/NORTH_STAR.md
Tracker: docs/projects/phb2024_glossary_audit/TRACKER.md
Gaps: docs/projects/phb2024_glossary_audit/GAPS.md

## Previous Agent Handoff

Iteration 1 established the living-project handoff and documented the completed
PHB 2024 glossary family scope. This pass refreshed the dashboard schema and
synced the tracker, gaps, and north star to the current state.

## Current Mission

Active task:
Refresh the living-project docs, then pick the highest-value open gap from
`GAPS.md`, starting with `itemMetadata` contract parity if the owning project is
available.

Acceptance criteria:
`NORTH_STAR.md` includes an up-to-date `Dashboard Card Schema`; `TRACKER.md`,
`GAPS.md`, and `NORTH_STAR.md` agree on scope, open gaps, and next action; and
the next agent has one concrete gap-routing action instead of a vague resume
instruction.

Key files to touch:
- docs/projects/phb2024_glossary_audit/NORTH_STAR.md
- docs/projects/phb2024_glossary_audit/TRACKER.md
- docs/projects/phb2024_glossary_audit/GAPS.md
- docs/projects/phb2024_glossary_audit/COLD_START_AGENT_PROMPT.md
- docs/projects/PROJECT_CARD_SCHEMA.md
- docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Scoped verification:
Use `git diff --check` for the markdown edits and keep the proof narrative in
the docs themselves. No runtime verification is needed for this pass.

Blocking dependencies / do-not-touch:
Stay inside this project's scope boundaries. Do not edit glossary runtime,
ingest scripts, or sibling-project docs unless the gap is explicitly routed.

Recent progress:
Dashboard schema added, tracker/gaps tightened, and the remaining work is
project-gap routing rather than implementation.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous
agent context, active task, acceptance criteria, key files, verification
method, blockers, recent progress, workflow-gap review result, and
dashboard-schema updates. Keep only the current handoff between the same
BEGIN/END markers; do not preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---

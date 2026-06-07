# Phb2024 Glossary Audit Cold Start Agent Handoff

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
docs/projects/phb2024_glossary_audit/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Phb2024 Glossary Audit
Project folder: docs/projects/phb2024_glossary_audit
Iteration: 2
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
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

Key files to touch:
- docs/projects/phb2024_glossary_audit/NORTH_STAR.md
- docs/projects/phb2024_glossary_audit/TRACKER.md
- docs/projects/phb2024_glossary_audit/GAPS.md
- docs/projects/phb2024_glossary_audit/COLD_START_AGENT_PROMPT.md
- docs/projects/phb2024_glossary_audit/DECISIONS.md
- docs/projects/phb2024_glossary_audit/AUDIT_OR_PROOF.md
- docs/projects/phb2024_glossary_audit/RUNBOOK.md
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

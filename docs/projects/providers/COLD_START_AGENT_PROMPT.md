# Providers Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/providers/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Providers
Project folder: docs/projects/providers
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/providers/NORTH_STAR.md
Tracker: docs/projects/providers/TRACKER.md
Gaps: docs/projects/providers/GAPS.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Multi-agent worker fallback while gpt-5.3-codex-spark was usage-limited; provider-doc review plus source read-through of `App.tsx`, `AppProviders.tsx`, `DataLoaderGate.tsx`, `SpellContext.tsx`, and `GlossaryContext.tsx` |

## Current Slice

- G2 is now resolved as the current startup matrix: only null contexts block non-main-menu entry; degraded spell/glossary loads remain visible with overlays and empty fallbacks.
- G3 is now resolved as the explicit provider boundary note: `AppProviders` wraps `GameProvider` in `App.tsx`, and the provider nesting order is fixed in the docs.
- G4 is waiting; the project is review-required because G5 needs a provider-boundary decision.
- Do not assign further Providers work until the G5 decision is recorded.

## Verification

- Docs consistency review against `App.tsx`, `AppProviders.tsx`, `DataLoaderGate.tsx`, `SpellContext.tsx`, and `GlossaryContext.tsx`.
- No source or unit tests were run because this slice stayed in documentation.

## Blockers And Notes

- `G4` is support-needed but waiting behind the project review gate.
- `G5` is `blocked_human_decision`; the Required Review Brief lives in `NORTH_STAR.md`.
- Workflow gaps were read; no new workflow-level ambiguity was found.

## Required Docs

- Accounted for: `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, `COLD_START_AGENT_PROMPT.md`
- Not present and not needed this iteration: `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`

## Next Safe Resume Action

- Await the G5 provider-boundary decision before assigning further Providers work.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---

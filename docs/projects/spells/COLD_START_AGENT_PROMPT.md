---
schema_version: 1
handoff_type: agent_to_agent
project: Spells
slug: spells
status: active
last_updated: 2026-06-25
iteration: 0
source_agent: Codex
target_agent: next cold-start agent
runtime_surface: desktop app
certainty: certain
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/spells/NORTH_STAR.md
tracker: docs/projects/spells/TRACKER.md
gaps: docs/projects/spells/GAPS.md
subprojects: docs/projects/spells/SUBPROJECTS.md
---
# Spells Parent Routing Prompt

Last updated: 2026-06-25

You are entering the Spells parent scoped-dashboard. Do not treat this folder as a single executable spell-work pass. Your first job is to choose the child lane that owns the work, inspect the rendered dashboard handoff when available, then run the implementation or audit pass inside that child packet.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

---BEGIN NEXT AGENT HANDOFF---
Project: Spells
Project folder: docs/projects/spells
Iteration field: 0
agent_comments: Parent is a scoped routing dashboard; child packets own executable pass state and proof.

## Iteration Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 0 | Codex | desktop app | certain | 2026-06-22 | Parent/subproject template reshape from annotated project UI template request. |

## Mission

Route spell work through the correct child lane before coding. Update the parent only when routing, ownership, imported gaps, dashboard state, or cross-lane priority changes.

## Required Read Order

1. `docs/projects/spells/NORTH_STAR.md`
2. `docs/projects/spells/SUBPROJECTS.md`
3. `docs/projects/spells/GAPS.md` for parent-visible imported gaps only.
4. The rendered project tracker's recommended-lane callout and handoff preview when the local dashboard is available.
5. The child packet named by the user, the active tracker row, the recommended-lane handoff, or the highest-impact gap.
6. `docs/projects/spells/DECISIONS.md` if lane ownership, parent import, or support-project routing is ambiguous.
7. `docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md` if you are doing a full project iteration.

## Routing Rules

- Use an owned lane when Spells directly owns the implementation or audit slice.
- Use linked support when another project provides evidence or tooling but Spells decides whether to import the product gap.
- Use adjacent dependency when a project is related but should not be folded into Spells.
- Keep child proof, child iteration status, and child local gaps in the child setup packet.
- Use the rendered `Recommended next lane`, `Show lane details`, `Preview handoff packet`, and `Copy handoff` controls before launching a new child-lane agent when the dashboard is available.
- If the dashboard is unavailable, fall back to `SUBPROJECTS.md` frontmatter `highest_priority`, the lane table, and the child packet files.

## Current Priority Signal

The current highest-impact parent-visible lane is the created-object / persistent-structure mechanics stream. The rendered parent dashboard should recommend Mechanics Discovery Packages from `SUBPROJECTS.md` `highest_priority` and show `Registry proof: current`. Inspect that lane's details and handoff preview, then continue from `docs/projects/spells/subprojects/mechanics-discovery-packages/NORTH_STAR.md` unless the user overrides priority.

## Required End State For This Iteration

Before closing a future iteration, update this handoff with the latest active child lane, parent-routing changes, files touched, verification performed, parent-visible gaps imported, workflow gaps checked, dashboard schema changes, and next safe resume action. Keep only the current handoff between the BEGIN/END markers.

---END NEXT AGENT HANDOFF---

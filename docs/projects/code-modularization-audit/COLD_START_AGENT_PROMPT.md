# Code Modularization Audit Cold Start Agent Handoff

Status: active
Last updated: 2026-06-09

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/code-modularization-audit/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |
| 3 | Codex / GPT-5 | Codex desktop foreman | certain | 2026-06-09 | Foreman consistency pass found `TRACKER.md` already marked CMA-T7 done and corrected this stale handoff |

---BEGIN NEXT AGENT HANDOFF---
Project: Code Modularization Audit
Project folder: docs/projects/code-modularization-audit
Iteration: 4
North Star: docs/projects/code-modularization-audit/NORTH_STAR.md
Tracker: docs/projects/code-modularization-audit/TRACKER.md
Gaps: docs/projects/code-modularization-audit/GAPS.md

## Current Mission

Hold the project in routing/evidence mode until owning projects accept the
already-routed CMA-G14..G19 candidate clusters. `TRACKER.md` marks CMA-T7 done,
so the next agent should not re-propagate those rows or start source movement
from this project alone.

## Required End State For This Iteration

- Confirm the owning project is active and not review-gated before assigning any
  split-planning or source-movement work.
- Treat CMA-G14..G19 as routed candidate evidence, not implementation approval.
- If an owning project accepts a route, create the smallest owner-local split
  plan with explicit preservation tests and visual proof where relevant.
- If no owner has accepted a route, leave this project unassigned and keep the
  next step as owner-acceptance monitoring.

## Required Files

- `docs/projects/code-modularization-audit/NORTH_STAR.md`
- `docs/projects/code-modularization-audit/TRACKER.md`
- `docs/projects/code-modularization-audit/GAPS.md`
- `docs/projects/PROJECT_TRACKER.md`

## Suggested Evidence Commands

- `Get-ChildItem -Path src,scripts,devtools -Recurse -Include *.ts,*.tsx,*.js,*.jsx,*.cjs,*.mjs -File`
- `rg -n "from './|from '../|describe\\(|it\\(" <candidate-path-or-folder>`

## agent_comments

- No active inline agent comments are carried into the next iteration.
---END NEXT AGENT HANDOFF---

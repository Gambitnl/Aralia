# Code Modularization Audit Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
Project entry point: docs/projects/code-modularization-audit/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 2 | Codex / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-08 | Spawned by the foreman as a bounded living-project iteration worker |

---BEGIN NEXT AGENT HANDOFF---
Project: Code Modularization Audit
Project folder: docs/projects/code-modularization-audit
Iteration: 3
North Star: docs/projects/code-modularization-audit/NORTH_STAR.md
Tracker: docs/projects/code-modularization-audit/TRACKER.md
Gaps: docs/projects/code-modularization-audit/GAPS.md

## Current Mission

Propagate the routed CMA-G14..G19 candidate clusters into the owning project trackers/gaps before any code movement. This is still a preservation-first routing pass, not a cleanup pass.

## Required End State For This Iteration

- Owner-facing follow-ups are added for the routed CMA-G14..G19 rows:
  - `three-d-modal` scene/props stays visual-proof driven
  - `battle-map` actor/terrain stays render-parity driven
  - `submap` pane/painter extraction preserves atlas and legacy-path behavior
  - `layout` keeps modal orchestration split-only until acceptance
  - `combat` preserves turn flow, log state, and encounter generation
  - `scripts-audits` keeps the generator/harvest sequence intact
- Next safe iteration should only move code after an owning project has accepted the route and has a focused verification path.

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

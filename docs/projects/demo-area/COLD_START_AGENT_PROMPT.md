---
schema_version: 1
handoff_type: agent_to_agent
project: Demo Area
slug: demo-area
status: active
last_updated: "2026-06-06"
iteration: 2
source_agent: Not recorded
target_agent: next cold-start agent
runtime_surface: unknown
certainty: unknown
workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
workflow_gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
dashboard_schema: docs/projects/PROJECT_CARD_SCHEMA.md
north_star: docs/projects/demo-area/NORTH_STAR.md
tracker: docs/projects/demo-area/TRACKER.md
gaps: docs/projects/demo-area/GAPS.md
---
# Demo Area Cold Start Agent Handoff

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
docs/projects/demo-area/NORTH_STAR.md

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 1 | Not recorded | unknown | unknown | 2026-06-10 | Ledger initialized during prompt normalization |
| 2 | Gemini 3.5 Flash | local dev / playwright | high | 2026-06-11 | Mounted CombatMessagingDemo to Dev Menu and verified rendering |

---BEGIN NEXT AGENT HANDOFF---
Project: Demo Area
Project folder: docs/projects/demo-area
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/demo-area/NORTH_STAR.md
Tracker: docs/projects/demo-area/TRACKER.md
Gaps: docs/projects/demo-area/GAPS.md

## Previous Agent Handoff

The prior pass resolved G1 (retention decision: keep CombatMessagingDemo as reference artifact) and G2 (mounted CombatMessagingDemo in DevMenu, aligning registry path with runtime). Headless Playwright script ran successfully and captured visual proof of rendering.

## Current Mission

Active task:
Verify and keep the demo area documentation and code stable. If any new demo files are added to components/demo, perform a gap scan and update the tracker.

Acceptance criteria:
- Main app launches and allows navigating to Combat Messaging Demo via Dev Menu.
- All documents in the demo-area folder remain consistent.

Key files to touch:
- docs/projects/demo-area/NORTH_STAR.md
- docs/projects/demo-area/TRACKER.md
- docs/projects/demo-area/GAPS.md
- docs/projects/demo-area/COLD_START_AGENT_PROMPT.md

Scoped verification:
Run `node take_combat_messaging_screenshot.js` to ensure the Dev Menu and Combat Messaging Demo render successfully.

Blocking dependencies / do-not-touch:
None.

Recent progress:
CombatMessagingDemo was mounted to the Dev Menu in App.tsx and DevMenu.tsx, resolving the orphaned state. All gaps G1 and G2 are now resolved.

---END NEXT AGENT HANDOFF---

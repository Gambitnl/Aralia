# Conversation Panel Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps reviewed:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/conversation-panel/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: Conversation Panel
Project folder: docs/projects/conversation-panel
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/conversation-panel/NORTH_STAR.md
Tracker: docs/projects/conversation-panel/TRACKER.md
Gaps: docs/projects/conversation-panel/GAPS.md

Previous agent context:
- Iteration 2 documented the project scope and initial gap list.
- This pass wired `START_CONVERSATION` from gameplay `talk` actions for companions and enforced `isPlayerTurn`-based interaction locking.

Current mission:
- Active task from tracker: T3 - coordinate exclusivity policy with `CMA-G12`.
- Acceptance criteria: keep `START_CONVERSATION` reachable from `talk`, keep gating (`isInteractionLocked`) applied for send/input, and route cross-project exclusivity policy to `docs/projects/code-modularization-audit/CMA-G12`.

Key files touched:
- docs/projects/conversation-panel/NORTH_STAR.md
- docs/projects/conversation-panel/TRACKER.md
- docs/projects/conversation-panel/GAPS.md
- docs/projects/conversation-panel/COLD_START_AGENT_PROMPT.md
- src/hooks/actions/handleNpcInteraction.ts
- src/hooks/useConversation.ts
- src/components/ConversationPanel/ConversationPanel.tsx
- src/state/appState.ts
- src/state/initialState.ts

Verification done:
- Docs consistency scan of tracker/surface files + runtime-path scans with `rg`.
- Typecheck attempted (`npx tsc -p tsconfig.json`), but repository has pre-existing errors unrelated to this iteration (documented in final report).
- Scoped test run: `npm test -- --run src/hooks/__tests__/useCompanionBanter.test.ts` (1 file passed).

Recent progress:
- CP-001, CP-002, CP-003 are marked done in `GAPS.md` and `TRACKER.md`.
- Remaining live gap: CP-004 remains `adjacent_follow_up` in `docs/projects/code-modularization-audit/CMA-G12`.
- `ConversationPanel` should now open when talking to a companion action target; player controls are locked when it is not player turn or AI is pending.

Required next updates:
- Ensure required docs are checked (`DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`) and explicitly note if absent (not present in this folder today).
- Keep required-doc updates limited to this project's scope.

Iteration ledger:
| Iteration | Agent | Runtime surface | Certainty | Date (UTC+2) | Source clue |
|---|---|---|---|---|---|
| 3 | Codex / gpt-5.3-codex-spark (MCP-subagent) | MCP-subagent / Terminal+Docs | certain | 2026-06-08 | `NORTH_STAR.md`, `TRACKER.md`, `GAPS.md`, source scans |

## Required End State Notes
- Files intended to be updated are listed above.
- Optional docs (`DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`) were not found in this project folder.
- Documentation compaction performed by replacing legacy handoff text with a compact handoff block.
- No Required Review Brief was added because this pass did not reach an unresolved human decision gate.
## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, agent identity/runtime surface, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers.

---END NEXT AGENT HANDOFF---

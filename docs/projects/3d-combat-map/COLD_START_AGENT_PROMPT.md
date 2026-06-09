# 3D Combat Map Cold Start Agent Handoff

Status: active
Last updated: 2026-06-08

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/3d-combat-map/NORTH_STAR.md

---BEGIN NEXT AGENT HANDOFF---
Project: 3D Combat Map
Project folder: docs/projects/3d-combat-map
Iteration: 5
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/3d-combat-map/NORTH_STAR.md
Tracker: docs/projects/3d-combat-map/TRACKER.md
Gaps: docs/projects/3d-combat-map/GAPS.md
Audit/proof: docs/projects/3d-combat-map/AUDIT_OR_PROOF.md

Agent identity / runtime:
Next agent must identify its model and runtime surface before selecting work.
This handoff was refreshed after MCP subagent Kuhn completed G8 required-doc
accounting.

## Iteration Agent Ledger

| Iteration | Agent/model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 5 | Kuhn / gpt-5.3-codex-spark high | MCP/subagent | certain | 2026-06-08 | Subagent completion notification `019ea7d6-7456-7d63-8459-9bfae3d0e289` |

## Previous Agent Handoff

Iteration 3 ran NC1 and attempted NC2. (Heads-up: two agents executed iteration 3
concurrently — a Codex pass and a Claude/Opus pass — so reconcile if any row or
finding looks doubled.) NC1 (visual smoke, G2) PASSED: a browser BattleMapDemo 3D
render showed no repeated GL_INVALID_OPERATION / glBlitFramebuffer / SSAO /
NormalPass errors, and it was independently reproduced headless (forest, canvas
918px, terrain + tree variety + actors render). G2 is CLOSED. One non-blocking
terrain shader warning (X4000 uninitialized f_getTerrainColor) was split out as G6.
NC2 was attempted but BLOCKED (G7): the offline save fixture loads the World3D
exploration surface (no ActionPane System Menu), so the headless path to a combat
encounter (Dev Menu → Generate Encounter → Simulate Battle → CombatView) is
unreachable. A ready NC2 harness exists at
.agent/3d-visual-quality/captures/nc2-combatview.mjs. Static review: the CombatView
3D path is structurally sound and was reworked (T5) to fix the canvas-measure root
cause behind the stale ".agent task 24" note, so residual G3 risk is narrowed to
the CombatView host mount + pop-out remount. Doc-hygiene gap G8 was opened
(required_docs declared DECISIONS.md/RUNBOOK.md, both were absent), and has now been
closed by adding the missing docs.

## Current Mission

Active task:
Unblock and run NC2 (G7), then close or re-scope G3. The blocker is reaching a
CombatView combat encounter headlessly — the renderer itself is already proven by
NC1.

Acceptance criteria:
- G7 / NC2: get the app into a real combat encounter (CombatView), toggle 3D, and
  record whether BattleMap3D mounts (a sized canvas) or hits the ErrorBoundary
  fallback ("An error occurred in the Battle Map."); then pop out → interact →
  return and confirm renderMode stays 3d, turn order + selected token persist, and
  the 2D/3D toggle still works. Unblock via one of: (a) capture a 2D-exploration
  save fixture with save-bridge.mjs while the app is in classic (non-World3D)
  exploration so the System Menu is present; (b) add a small dev hook that
  dispatches a battle-map encounter directly; (c) script the World3D→combat
  trigger. Then run nc2-combatview.mjs and record the result in AUDIT_OR_PROOF.md.
- If NC2 still cannot be reached, record the refined blocker and instead run the G4
  browser slope-click proof, or investigate the G6 terrain-shader warning.

Key files to touch:
- docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/DECISIONS.md
- docs/projects/3d-combat-map/RUNBOOK.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- .agent/3d-visual-quality/captures/nc2-combatview.mjs (ready NC2 harness)
- .agent/3d-visual-quality/captures/nc1-console.mjs (NC1 harness, reusable)
- src/components/Combat/CombatView.tsx (NC2 surface; do not edit unless fixing)
- src/components/BattleMap/BattleMap3D.tsx (renderer surface; do not edit unless fixing)

Scoped verification:
Observable change → collect empirical proof. The reusable headless harnesses live
in .agent/3d-visual-quality/captures/ and need the dev server on port 5174
(`npm run dev -- --port 5174 --strictPort`) so the storageState autosave origin
matches. Verify in-browser; do not ask for manual confirmation. If blocked from
running, record the blocker + next proof and fall back to docs_consistency.

Blocking dependencies / do-not-touch:
Stay inside this project's combat-only scope. Do not absorb World3D or ThreeDModal
behavior (out of scope per NORTH_STAR) — navigating *through* the World3D UI to
reach combat is acceptable, but do not edit World3D docs/code. Route sibling-project
blockers instead of editing their docs.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, GAPS.md, and AUDIT_OR_PROOF.md as the current source
of truth. T1–T5 done. G1, G2 closed; NC1 done (independently reproduced). Open:
G3 (pop-out proof, blocked by G7), G4 (slope proof), G5 (style policy), G6 (shader
warning), G7 (NC2 reach-fixture blocker). WORKFLOW_GAPS
WFG-001 reviewed; the cold-start prompt pointed at the canonical
docs/agent-workflows/living-project-task-protocol/ paths and they resolved cleanly,
so no +1 was added.

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

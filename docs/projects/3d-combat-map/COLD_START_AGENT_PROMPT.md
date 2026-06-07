# 3D Combat Map Cold Start Agent Handoff

Status: active
Last updated: 2026-06-07

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
Iteration: 3
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/3d-combat-map/NORTH_STAR.md
Tracker: docs/projects/3d-combat-map/TRACKER.md
Gaps: docs/projects/3d-combat-map/GAPS.md
Audit/proof: docs/projects/3d-combat-map/AUDIT_OR_PROOF.md

## Previous Agent Handoff

Iteration 2 completed T4 (the next-check list). Two standing acceptance checks
now exist — NC1 (visual smoke, guards G2) and NC2 (integration, guards G3) —
indexed in TRACKER.md and defined step-by-step in the new AUDIT_OR_PROOF.md. The
bounded gap sweep found that G2 was stale: SSAO + enableNormalPass were already
removed from BattleMap3D.tsx (lines 228-251) and replaced with ContactShadows, so
G2 was reclassified to "live-proof pending" rather than re-fixing removed code.
GAPS.md G1 was also synced to closed (it had drifted out of step with TRACKER.md).
NORTH_STAR.md gained YAML frontmatter (schema_version 1).

## Current Mission

Active task:
Execute NC1 (visual smoke) and NC2 (integration) from the Next-Check List and
record empirical results in AUDIT_OR_PROOF.md. Use the evidence to close or
advance G2 and G3.

Acceptance criteria:
- NC1: a ~5s 3D render pass with camera movement shows terrain, grid, and actors
  with no repeated GL_INVALID_OPERATION / glBlitFramebuffer / SSAO / NormalPass
  console errors. If clean, close G2.
- NC2: enter combat → 3D → pop-out → interact → return; renderMode stays 3d, turn
  order and selected token persist, and the 2D/3D toggle still works. Resolve or
  re-scope G3 on the result.
- Record both results (date, pass/fail, short evidence excerpt) in the
  AUDIT_OR_PROOF.md Proof Log.
If the app cannot be run this pass, record the blocker and pivot to G4 (terrain
raycast/tile mapping, in_scope_now) as the implementation task instead.

Key files to touch:
- docs/projects/3d-combat-map/AUDIT_OR_PROOF.md
- docs/projects/3d-combat-map/TRACKER.md
- docs/projects/3d-combat-map/GAPS.md
- docs/projects/3d-combat-map/NORTH_STAR.md
- docs/projects/3d-combat-map/COLD_START_AGENT_PROMPT.md
- src/components/BattleMap/BattleMap3D.tsx (NC1 surface; do not edit unless fixing)
- src/components/Combat/CombatView.tsx (NC2 surface; do not edit unless fixing)

Scoped verification:
The change is observable, so collect empirical proof: browser console capture for
NC1 and a pop-out flow check (state note or before/after screenshots) for NC2. Use
preview tools; verify in-browser rather than asking for manual confirmation. If the
slice ends up docs-only (blocked from running), use docs_consistency and record the
blocker + next proof.

Blocking dependencies / do-not-touch:
Stay inside this project's combat-only scope. Do not absorb World3D or ThreeDModal
behavior (out of scope per NORTH_STAR). Route sibling-project blockers instead of
editing their docs.

Recent progress:
Use NORTH_STAR.md, TRACKER.md, GAPS.md, and AUDIT_OR_PROOF.md as the current source
of truth. T1, T2, T3, T4, T5 done. G1 closed. G2 reclassified (live-proof pending).
G3, G4, G5 open. WORKFLOW_GAPS.md WFG-001 reviewed; canonical paths resolved cleanly
this pass, so no +1 was added.

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

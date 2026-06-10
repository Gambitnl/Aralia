# Combat System Cold Start Agent Handoff

Status: review-required
Last updated: 2026-06-09

This file is the project-specific context package and directive checklist for the next cold-start agent. It does not duplicate the full workflow rules. The agent must follow the shared workflow file and use this file for current project context, resume state, and closeout obligations.

Shared workflow:
docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md

Workflow gaps:
docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md

Dashboard schema:
docs/projects/PROJECT_CARD_SCHEMA.md

Project entry point:
docs/projects/combat/NORTH_STAR.md

## Iteration Ledger

| Iteration | Agent/Model | Runtime surface | Certainty | Date | Source clue |
|---|---|---|---|---|---|
| 3 | Turing / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019eaa02-7983-7b90-803c-3e2aedbe7a2f` |
| 4 | Curie / gpt-5.4-mini high | MCP-subagent | certain | 2026-06-09 | Subagent completion notification `019eaa22-a04b-7690-87dd-70f409116f9f` |
| 5 | Volta / gpt-5.4-mini high | MCP-subagent + focused combat tests + docs audit | certain | 2026-06-09 | Verified the death-save slice in source/tests and routed the stale G4 note out of the open queue. |
| 6 | Ramanujan / gpt-5.4-mini high | MCP-subagent + local foreman repair | certain | 2026-06-09 | Verified the AI loop cap, move/ability sequencing, and auto-controlled ally coverage in `useCombatAI.ts`; foreman removed a stale dependency re-entry risk before acceptance. |
| 7 | Codex / GPT-5 | local foreman + focused combat tests + docs sync | certain | 2026-06-09 | Verified Sentinel OA stop-in-place mechanics in `useActionExecutor.ts` / `useActionExecutor.test.ts` and synced the Combat living-project docs. |
| 8 | Codex / GPT-5 | local foreman + focused combat tests + docs sync | certain | 2026-06-09 | Verified War Caster OA spell-option handling in `useActionExecutor.ts` / `useActionExecutor.test.ts`, wired the spell branch through `useTurnManager.ts` and `CombatView.tsx`, and synced the Combat living-project docs. |
| 9 | Codex / gpt-5.4-mini high | local foreman + focused combat tests + docs sync | certain | 2026-06-09 | Verified encounter-scoped combat log persistence in `useCombatLog.ts` / `CombatView.tsx`, closed G23 with focused tests, and updated the Combat docs plus imported global gap routing. |
| 10 | Chandrasekhar / gpt-5.4-mini high | MCP-subagent + in-app browser visual check | certain | 2026-06-09 | Verified the G20 2D token defense-badge slice in `CharacterToken.tsx` / `CharacterToken.test.tsx`; 3D overlay parity was still the follow-up at that time. |
| 11 | Anscombe / gpt-5.4-mini high | MCP-subagent + local foreman verification | certain | 2026-06-09 | Closed G20 by mirroring resistance, vulnerability, and immunity into a compact always-on 3D actor badge row in `CharacterActor.tsx` / `CharacterActor.defense.test.tsx`. |

---BEGIN NEXT AGENT HANDOFF---
Project: Combat System
Project folder: docs/projects/combat
Iteration: 11
Shared workflow: docs/agent-workflows/living-project-task-protocol/ITERATION_AGENT_WORKFLOW.md
Workflow gaps: docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md
Dashboard schema: docs/projects/PROJECT_CARD_SCHEMA.md
North Star: docs/projects/combat/NORTH_STAR.md
Tracker: docs/projects/combat/TRACKER.md
Gaps: docs/projects/combat/GAPS.md

## Previous Agent Context

Iteration 10 completed the 2D token-badge slice for G20. Source, focused tests, and in-app browser inspection now show resistance, vulnerability, and immunity badges on the BattleMap token layer. Iteration 11 closed the mirrored 3D actor badge row, so G20 is now done.

## Current Mission

Active task:
G20 is now closed with both 2D token badges and a mirrored 3D actor overlay. Combat is review-required because G30 is the only remaining hold and needs the Required Review Brief answered before more implementation work is assigned.

Acceptance criteria:
Do not assign implementation work in Combat until the G30 Required Review Brief is answered. Do not reopen G20, G23, G24, or G25 unless a new evidence-backed issue appears.

Key files to touch:
- `src/components/BattleMap/BattleMap.tsx`
- `src/components/BattleMap/*` related UI surface as needed for the overlay/badge slice
- `docs/projects/combat/NORTH_STAR.md`
- `docs/projects/combat/TRACKER.md`
- `docs/projects/combat/GAPS.md`
- `docs/projects/combat/COLD_START_AGENT_PROMPT.md`
- `docs/projects/combat/DECISIONS.md`
- `docs/projects/combat/AUDIT_OR_PROOF.md`
- `docs/projects/combat/RUNBOOK.md`
- `docs/projects/GLOBAL_GAPS.md` if any routing cleanup is needed

Scoped verification:
Run focused tests or the smallest reliable visual check for the selected slice, plus `node scripts/audit-living-project-docs.cjs` and `git diff --check` before closeout.

Blocking dependencies / do-not-touch:
Keep G30 modularization review-required. Do not split `useAbilitySystem`, `useCombatEngine`, or `App.tsx`. Stay out of unrelated combat rules slices unless a tiny evidence note is required.

Recent progress:
G20 now has verified 2D token-badge and 3D actor-overlay parity in the BattleMap layer. The 2D Fire Elemental / Skeleton badges were checked in the in-app resistance scenario; the 3D parity slice is source-backed and covered by the focused actor-layer test because the live Battle Map Demo route was blocked during this pass. G23 combat log persistence is now verified and closed. G24 War Caster spell-option handling is closed. G25 Sentinel stop-in-place mechanics are closed. G3, G4, G11, G12, G19, G21, G26, G27, G28, and G29 remain done. G30 is still blocked on a human decision.

Workflow-gap review:
`docs/agent-workflows/living-project-task-protocol/WORKFLOW_GAPS.md` was read on 2026-06-09. No new workflow-level ambiguity was opened.

Dashboard-schema updates:
`docs/projects/combat/NORTH_STAR.md` now marks Combat review-required with a Required Review Brief for G30, and `TRACKER.md` / `GAPS.md` mark the G20 2D + 3D parity slice as verified while keeping G30 as the human decision hold. `docs/projects/PROJECT_TRACKER.md` was checked earlier in the Combat pass and did not need a Combat-specific row edit. The combat support docs still parse cleanly.

Required docs accounted for:
- `NORTH_STAR.md`
- `TRACKER.md`
- `GAPS.md`
- `COLD_START_AGENT_PROMPT.md`
- `PROJECT_CARD_SCHEMA.md`
- `WORKFLOW_GAPS.md`
- `DECISIONS.md`
- `AUDIT_OR_PROOF.md`
- `RUNBOOK.md`
- `GLOBAL_GAPS.md`

Optional docs:
- `DECISIONS.md`, `AUDIT_OR_PROOF.md`, `RUNBOOK.md`, and `GLOBAL_GAPS.md` were updated to keep the combat log persistence decision, proof trail, and imported global gap routing aligned with the current slice.
- `PROJECT_TRACKER.md` was checked and left unchanged because it only carries the global project map.

Assumptions:
- G23, G24, and G25 are resolved and should stay closed unless a new evidence-backed issue appears.
- The next safe Combat action is human review of the G30 modularization ownership/test-boundary decision; do not assign implementation work before that review.

## Required End State For This Iteration

Before ending, update this handoff with the next iteration number, previous agent context, active task, acceptance criteria, key files, verification method, blockers, recent progress, workflow-gap review result, and dashboard-schema updates. Account for every required doc, mention optional docs touched or skipped, update `agent_comments` only when an out-of-flow note is useful, and keep only the current handoff between the same BEGIN/END markers; do not preserve old handoff transcripts in this file.
---END NEXT AGENT HANDOFF---

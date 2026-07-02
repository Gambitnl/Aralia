# Combat Messaging Enhancement Tracker

Status: active
Last updated: 2026-07-01

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `out_of_scope`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| CMB-01 | done | Confirm docs now reflect current live combat messaging wiring and references | Worker D | 2026-05-31 | `src/components/Combat/CombatView.tsx`; `src/utils/combat/combatLogToMessageAdapter.ts` | Refresh gap list with verifier-facing findings | Confirm all log emitters in `src/hooks/combat/*.ts` are represented |
| CMB-02 | active | Verify event payload alignment for combat log -> rich messaging bridge | Worker D | 2026-07-01 | `src/types/combat.ts`; `src/utils/combat/combatLogToMessageAdapter.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts` | Damage/heal alias proof is done; critical-hit metadata is done 2026-07-01 (emitters attach `data: { isHit, isCrit, rollResult }` in `useActionExecutor.ts` ~715/768, adapter reads it at `combatLogToMessageAdapter.ts:103`, test "classifies critical opportunity attacks from structured log data"); continue with resistance metadata in CMB-GAP-002. | Capture one proof log for resisted events |
| CMB-03 | active | Validate rich log UI format consistency for high-traffic events | Worker D | 2026-05-31 | `src/components/BattleMap/CombatLog.tsx`; `src/types/combatMessages.ts` | Capture format checks for damage/heal/status/turn messages | Verify title, color, and priority border behavior in combat flow |
| CMB-04 | active | Align scope-sensitive follow-up work and route cross-project items | Worker D | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`; `docs/projects/GLOBAL_GAPS.md` | Confirm every durable gap has classification and destination | Close or route each row by severity and ownership |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| CMB-GAP-001 | done | in_scope_now | Codex | Combat Messaging Enhancement | Docs refresh pass | Event data contracts are inconsistent (`damage` vs `damageAmount`, `healAmount` vs `heal`) across emitters | `src/types/combat.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/utils/combat/combatLogToMessageAdapter.ts`; `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts` | Mixed key names weaken adapter safety and can cause missing values in UI | Closed 2026-06-25: adapter tests now assert both legacy and canonical damage/heal keys are handled. | `npx vitest run src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts` passed 4/4 tests. |
| CMB-GAP-002 | active | support_needed_now | Worker D | Combat Messaging Enhancement | Payload quality review | Resist/vuln flags are not emitted into log data (critical-hit half CLOSED 2026-07-01 — emitters attach `isHit`/`isCrit`/`rollResult`, adapter consumes structured flags at line 103, regression test in place) | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/utils/combat/combatLogToMessageAdapter.ts`; `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts` | Reduces fidelity of resistance-rich messaging | Decide on canonical resistance fields (`isResisted`, `resistanceApplied`) and update emitters — none exist in `src/hooks/combat/` today | Capture one proof log for resisted events |
| CMB-GAP-003 | active | adjacent_follow_up | Worker D | Combat Messaging Enhancement | Adapter behavior audit | Several status and action mappings still depend on text includes for classification | `src/utils/combat/combatLogToMessageAdapter.ts` | Message type accuracy depends on message wording and is error-prone | Move key mappings to explicit payload markers | Add regression fixtures for representative combat logs |
| CMB-GAP-004 | active | adjacent_follow_up | Worker D | Combat Messaging Enhancement | UI format audit | `MessageChannel` outputs beyond `COMBAT_LOG` are currently not fully surfaced in `CombatLog` | `src/types/combatMessages.ts`; `src/components/BattleMap/CombatLog.tsx`; `src/hooks/combat/useCombatMessaging.ts` | UI claims a richer channel model but does not render all channel-specific behaviors | Clarify intended channel consumers and add a follow-up implementation task | Confirm behavior with screenshot/probe during real combat run |

## Update Rules

- Keep `TRACKER.md` and `GAPS.md` consistent each time a verification task advances.
- Add queue rows before attempting new implementation scope.
- Mark task rows with clear next-check and evidence before closing.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/combat-messaging-enhancement/TRACKER.md","sha256WithoutMarker":"24f1a6499d25269d37fc6a605f06ac44fc993b24127b66f4dcf5a4082b5b1fd7","markedAtUtc":"2026-06-25T22:29:38.623Z"} -->

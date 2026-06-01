# Combat Messaging Enhancement Gaps

Status: active
Last updated: 2026-05-31

## Purpose

This file records durable, in-project gaps that block a full "combat messaging completion claim". Non-local issues remain in `docs/projects/GLOBAL_GAPS.md`.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|
| CMB-GAP-001 | active | in_scope_now | Worker D | Combat Messaging Enhancement | Live audit while documenting this project | Combat log payload fields are inconsistent across emitters (`damage` vs `damageAmount`, `healAmount` vs `heal`, optional `source`) | `src/types/combat.ts`; `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/utils/combat/combatLogToMessageAdapter.ts` | Unstable extraction paths can produce missing values in rich message payloads | Add canonical payload schema + adapter fallback contract | One regression test for each legacy/canonical pair |
| CMB-GAP-002 | active | in_scope_now | Worker D | Combat Messaging Enhancement | Adapter mapping review | Critical hit and resist/vuln metadata are not carried through from engine-level events | `src/hooks/combat/engine/useCombatEngine.ts`; `src/hooks/combat/useActionExecutor.ts`; `src/utils/combat/combatLogToMessageAdapter.ts` | Message quality and strategic readability are reduced during peak combat moments | Decide and add explicit flags (`isCritical`, `isResisted`, `resistanceApplied`) | End-to-end combat sample with at least one critical and one resistance event |
| CMB-GAP-003 | active | adjacent_follow_up | Worker D | Combat Messaging Enhancement | Pattern classification review | `combatLogToMessageAdapter` still maps several event types by heuristics on `entry.message` | `src/utils/combat/combatLogToMessageAdapter.ts` | Classifier silently breaks on localization or copy edits of message strings | Introduce event-level classification hints or narrower message enums | Add golden-message fixtures for known string variations |
| CMB-GAP-004 | active | adjacent_follow_up | Worker D | Combat Messaging Enhancement | UI rendering review | Rich channels (`NOTIFICATION`, `VISUAL_EFFECT`, `AUDIO_CUE`) are defined but mostly stored only for future use | `src/types/combatMessages.ts`; `src/hooks/combat/useCombatMessaging.ts`; `src/components/BattleMap/CombatLog.tsx` | Documentation overstates channel model without runtime consumers | Clarify which channels are currently used and what belongs to later slices | Update docs and close UX expectations in NORTH_STAR |
| CMB-GAP-005 | active | support_needed_now | Worker D | Combat Messaging Enhancement | Cross-surface scan | Combat log is emitted in legacy format from many hooks, and some future-rich paths are not proven in one path | `src/components/Combat/CombatView.tsx`; `src/components/BattleMap/BattleMapDemo.tsx`; `src/hooks/combat/useCombatLog.ts` | Incomplete rollout can hide event coverage gaps and lead to false completion status | Run a single trace by event type across `turn_start`, `damage`, `heal`, `status`, `action` | Confirm all major event types appear in both legacy and rich arrays during encounter |

## Classification Reference

- `in_scope_now`: must be fixed before claiming completion.
- `support_needed_now`: required to continue verification with confidence.
- `adjacent_follow_up`: useful but not mandatory for current completion target.

## Routing Rule

- Keep these rows in this project unless the issue clearly belongs elsewhere.

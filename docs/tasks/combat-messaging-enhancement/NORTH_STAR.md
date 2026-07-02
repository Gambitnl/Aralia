# Combat Messaging Enhancement North Star

Status: active
Last updated: 2026-07-01

## Why This Project Exists

This folder captures where combat messaging stands today: core infrastructure is already present in live code, and the docs now serve as the cold-start record for verification and follow-up.

## Scope and Intent

- Keep project docs focused on: what is currently implemented, what is partial, and what is still uncertain.
- Preserve implementation evidence for future continuation without rebuilding context.
- Update only the scoped project docs in this folder, while routing non-local issues to `docs/projects/GLOBAL_GAPS.md`.

## File Map

- `NORTH_STAR.md`: scope, evidence, integration summary, and restart path.
- `TRACKER.md`: active task list and next checks.
- `GAPS.md`: durable in-project gaps and their routing.

## Implemented Foundation (Live Code Evidence)

- Typed lane definitions: `src/types/combatMessages.ts`
- Message factories and display helpers: `src/utils/combat/messageFactory.ts`
- Messaging state hook: `src/hooks/combat/useCombatMessaging.ts`
- Adapter from legacy log to rich messages:
  - `src/utils/combat/combatLogToMessageAdapter.ts`
- Dual-mode combat log rendering:
  - `src/components/BattleMap/CombatLog.tsx`
- Combat flow integration:
  - `src/components/Combat/CombatView.tsx`
  - `src/hooks/combat/useCombatLog.ts`
  - `src/hooks/combat/useTurnManager.ts`
  - `src/hooks/combat/engine/useCombatEngine.ts`
  - `src/hooks/combat/useActionExecutor.ts`
- Demo and preview surfaces:
  - `src/components/demo/CombatMessagingDemo.tsx`
  - `src/components/BattleMap/BattleMapDemo.tsx`

## Current State vs Planned

- In scope and complete: parallel rich-message storage, adapter bridge, and CombatLog rendering mode.
- Partial: full event-to-type coverage, payload quality, and channel-aware UI consumption.
- Planned: tighten engine-level payload contracts and reduce string-based classification in adapter logic.

## Integration Notes

- Legacy and rich formats remain both active:
  - `CombatLog` receives `logEntries` and optional `richMessages`.
  - `useCombatLog` remains the legacy sink.
  - `useCombatMessaging` provides the enriched stream.
- Religion trigger flow still consumes the legacy log:
  - `src/systems/religion/CombatReligionAdapter.ts`
- The same event stream supports both messaging and external log-based systems, so adapter and payload changes must remain backward compatible.

## Active Gaps

- Resistance/vulnerability metadata is not emitted into log data (open remainder of CMB-GAP-002). The critical-hit half is closed: emitters attach `isCrit`/`isCritical` and the adapter reads it from structured data (see GAPS.md CMB-GAP-002 evidence).
- Some event kinds still rely on message-text heuristics to infer type (CMB-GAP-003).
- Some message channels and rich metadata are defined but not yet fully surfaced in UI (CMB-GAP-004).

Closed since the last refresh: the payload-alias inconsistency (`damage` vs `damageAmount`, `heal` vs `healAmount`) closed as CMB-GAP-001 with adapter regression tests covering canonical and legacy keys.

## Next Checks

- Decide and add explicit resistance flags (`isResisted`, `resistanceApplied`) at the emitters, then extend the adapter and tests.
- Verify how often `combatLogToMessageAdapter.ts` depends on string heuristics for status and action events.
- Verify whether `MessageChannel` outputs are consumed beyond internal storage.
- Add explicit tests for kill/status edge cases. (Critical and heal alias edge-case tests now exist in `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts`.)

## Tracking Links

- `docs/projects/PROJECT_TRACKER.md` row: Combat Messaging Enhancement
- `docs/projects/GLOBAL_GAPS.md` for cross-project routing

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Execute tracker next checks and record results.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/combat-messaging-enhancement/NORTH_STAR.md","sha256WithoutMarker":"158c09adf0cadb89185c849768751813c01c39f67aa2d9fe7a8f84178c4c4127","markedAtUtc":"2026-06-25T22:29:38.622Z"} -->

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
- Partial: full event-to-type coverage and payload quality. Channel-aware UI consumption is
  now real for COMBAT_LOG and NOTIFICATION; VISUAL_EFFECT and AUDIO_CUE carry payloads but
  have no channel consumer yet (see Channel Audit).
- Planned: tighten engine-level payload contracts and finish migrating emitters onto
  `eventClass` so the adapter's text-derivation shim can be deleted.

## Integration Notes

- Legacy and rich formats remain both active:
  - `CombatLog` receives `logEntries` and optional `richMessages`.
  - `useCombatLog` remains the legacy sink.
  - `useCombatMessaging` provides the enriched stream.
- Religion trigger flow still consumes the legacy log:
  - `src/systems/religion/CombatReligionAdapter.ts`
- The same event stream supports both messaging and external log-based systems, so adapter and payload changes must remain backward compatible.

## Channel Audit

Verified: 2026-09-09 (agora-e29b).

Routing for every combat event is declared once, as data, in `COMBAT_EVENT_ROUTING`
(`src/types/combatMessages.ts`), keyed by `CombatEventClass`. That table is the answer to
"which channels does this event reach"; the table below is the answer to "who is listening".

| Channel | Status | Producer | Consumer |
| --- | --- | --- | --- |
| `COMBAT_LOG` | Wired | Every routing row | `src/components/Combat/CombatLog.tsx` (rich mode) and `src/components/BattleMap/CombatLog.tsx` |
| `NOTIFICATION` | Wired end to end | Routing rows for damage, heals, status changes, crits, kills, death saves, combat start/exit, level up | `useCombatMessaging.addMessage` -> `messageFactory.toNotificationDraft` -> `ADD_NOTIFICATION` -> `src/components/ui/NotificationSystem.tsx`. Gated by `NOTIFICATION_PRIORITY_FLOOR` (HIGH/CRITICAL only) so routine hits do not toast, and by `config.enableNotifications`. |
| `VISUAL_EFFECT` | Declared with a payload, no channel consumer | Rows carrying `visualEffect` (`impact_shake`, `critical_flash`, `death_burst`, `heal_pulse`, `buff_glow`, `debuff_glow`, `level_up_burst`) | KNOWN STUB. `src/components/BattleMap/vfx/VFXSystem.tsx` renders combat visuals today, but it is driven by combat state props (damage numbers, spell visuals, zones), not by message channels. Wiring it to subscribe to `visualEffect` is a separate slice. |
| `AUDIO_CUE` | Declared with a payload, no channel consumer | Rows carrying `soundCue` (`combat.critical_impact`, `combat.killing_blow`, `combat.death_save`, `combat.start`, `ui.level_up`) | KNOWN STUB. There is no sound-effect system in the repo: `src/hooks/useAudio.ts` is a PCM/TTS playback hook with no cue registry. The cue names above are the contract a future SFX system implements. |

Invariant enforced by test: a routing row declares `visualEffect` if and only if it lists
`VISUAL_EFFECT`, and `soundCue` if and only if it lists `AUDIO_CUE`. That is what stops the
channel model from drifting back into decoration.

## Active Gaps

- Resistance/vulnerability metadata is not emitted into log data (open remainder of CMB-GAP-002). The critical-hit half is closed: emitters attach `isCrit`/`isCritical` and the adapter reads it from structured data (see GAPS.md CMB-GAP-002 evidence).
- CMB-GAP-003 closed 2026-09-09: `CombatEventClass` + `COMBAT_EVENT_ROUTING` replaced the
  adapter's type/priority/channel decisions. `CombatLogEntry.eventClass` lets an emitter state
  its own classification; `deriveEventClass` remains as a per-record migration shim for the
  emitters that have not been migrated yet, and `resolveEventClass` is the only caller of it.
- CMB-GAP-004 closed 2026-09-09: see the Channel Audit above for wired vs stub channels.
- Remaining emitter migration (not blocking): only `CombatLogService.createDamageLogEntry`
  stamps `eventClass` so far. `useCombatEngine`, `useTurnManager` and `useActionExecutor`
  still emit unstamped records and route through the derivation shim.

Closed since the last refresh: the payload-alias inconsistency (`damage` vs `damageAmount`, `heal` vs `healAmount`) closed as CMB-GAP-001 with adapter regression tests covering canonical and legacy keys.

## Next Checks

- Decide and add explicit resistance flags (`isResisted`, `resistanceApplied`) at the emitters, then extend the adapter and tests.
- Migrate the remaining emitters to stamp `eventClass`, then measure how often
  `deriveEventClass` still runs before deleting it.
- Decide whether `VFXSystem` should subscribe to the `VISUAL_EFFECT` channel payload, and
  whether an SFX layer is worth adding for `AUDIO_CUE`.
- Add explicit tests for kill/status edge cases. (Critical and heal alias edge-case tests now exist in `src/utils/combat/__tests__/combatLogToMessageAdapter.test.ts`.)

## Tracking Links

- `docs/projects/PROJECT_TRACKER.md` row: Combat Messaging Enhancement
- `docs/projects/GLOBAL_GAPS.md` for cross-project routing

## Resume Path

1. Read this file.
2. Read `TRACKER.md`.
3. Read `GAPS.md`.
4. Execute tracker next checks and record results.

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/combat-messaging-enhancement/NORTH_STAR.md","sha256WithoutMarker":"96150afc553c209c262e58b4c63dec80fb69dc95ac2e861b4421bf14275434b5","markedAtUtc":"2026-08-09T20:14:15.790Z"} -->

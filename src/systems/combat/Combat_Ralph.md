# Combat Component Audit (Historical Pointer)

This file preserves the path of the May 2026 "Ralph" combat audit. It is not
the current Combat backlog.

Use these maintained surfaces instead:

- [`../../../docs/superpowers/specs/2026-07-14-absorbed-combat.md`](../../../docs/superpowers/specs/2026-07-14-absorbed-combat.md)
  (the combat project docset was absorbed into the planmap topic `world-reactions`
  on 2026-07-16; G32 rider-maintainability work is tracked there as a feature).
- [`../../../docs/projects/events/GAPS.md`](../../../docs/projects/events/GAPS.md)
  for cross-event-lane lifecycle and compatibility work.

## Verified disposition

Rechecked against the source and living project docs on 2026-07-15:

- The unused `CombatCharacter` imports were already removed from
  `AttackRiderSystem.ts` and `SustainActionSystem.ts`.
- Singleton test isolation was already implemented. `AttackEventEmitter`,
  `MovementEventEmitter`, and `SustainActionSystem` expose controlled instance
  replacement/fresh-instance helpers, with shared test helpers under
  `src/test/combatEmitters.ts`.
- The remaining suggestions are not safe cleanup. Extracting
  `AttackRiderSystem` predicates or narrowing its combat-type dependencies can
  alter matching behavior or public dependency shape, so Combat G32 preserves
  that intent behind focused regression tests and a separately selected
  refactor slice.

Do not relaunch the original implementation plans from this file. Their
completed work and deferred intent have already been classified in the living
Combat project.

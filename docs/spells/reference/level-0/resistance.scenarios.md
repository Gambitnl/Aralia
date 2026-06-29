# Resistance Scenarios

Source references:
- `docs/spells/reference/level-0/resistance.md`
- `public/data/spells/level-0/resistance.json`

## Spell components worth exercising

- 1 action, verbal and somatic only, no material component
- Touch range, single creature target, ally-only in the current combat validator
- Choose exactly one damage type from Acid, Bludgeoning, Cold, Fire, Lightning, Necrotic, Piercing, Poison, Radiant, Slashing, or Thunder
- 1 minute duration with concentration
- Defensive rider: reduce one qualifying damage instance by 1d4 once per turn
- No save roll, so save-modifier riders should stay untouched

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Resistance on a willing allied creature adjacent to the caster and expect exactly one chosen damage type to be protected, not all twelve. | FAIL | `src/commands/effects/DefensiveCommand.ts` applies every listed `damageType` value and never consumes `damageTypeSource: chosen_damage_type`, so the runtime does not preserve the spell's one-choice contract. |
| Cast Resistance on a willing allied creature adjacent to the caster and confirm the touch target is accepted. | PASS | `src/utils/spellAbilityFactory.ts` maps touch to a 1-tile combat range, and `src/hooks/combat/useTargetValidator.ts` accepts the ally-only target the spell data asks for. |
| Try to target a hostile enemy at touch range. | PASS | The spell's `validTargets: ["creatures", "allies"]` collapses to the ally path in `useTargetValidator`, so enemies are rejected. |
| Try to target a neutral non-ally at touch range. | PASS | Neutral-but-not-ally creatures fail the same ally filter as hostile targets. |
| Try to target a friendly-but-unwilling creature. | BLOCKED | The reviewed runtime has no separate willingness state; it can distinguish allies from non-allies, but not a willing ally from an unwilling one. |
| Try to cast Resistance beyond touch range. | PASS | Touch-range validation rejects a target outside the adjacent 1-tile / 5-foot window. |
| Try to target an object, door, or empty ground tile. | PASS | This spell is creature-only; `useAbilitySystem` only opens object targeting when the spell explicitly allows objects, and empty ground does not satisfy the ally-creature path. |
| Expect the runtime to prompt for a single damage type before execution. | FAIL | `damageTypeSource` is present in schema/data, but no runtime consumer was found for this spell; the defensive command reads the full list and applies it wholesale. |
| Take one hit of the chosen damage type and expect the 1d4 reduction to apply. | FAIL | The only live `damage_reduction` execution path is reaction-based in `src/commands/effects/DamageCommand.ts`; `Resistance`'s ongoing defensive row never consumes that rider. |
| Take a second qualifying hit in the same turn and expect the rider to be spent after the first use. | FAIL | There is no once-per-turn damage-reduction tracker for this spell path, so the 1d4 rider is not consumed or refreshed by current runtime state. |
| Let concentration end or break it and expect the protection to disappear. | FAIL | `BreakConcentrationCommand` clears riders, summons, light, status effects, and conditions, but not the plain `resistances` array written by `DefensiveCommand`; the minute-based defensive effect also is not decremented by the turn-manager tick. |
| Recast Resistance while the first cast is still active and expect the old protection to be replaced cleanly. | FAIL | The new cast can start concentration, but the prior resistance state is not reliably removed by the concentration cleanup path, so stale protection can linger instead of being replaced. |
| Use Resistance in combat or exploration as a pre-buff. | PASS | The cast path itself is a normal action + concentration buff, so it is available in both contexts even though the rider handling is incomplete. |
| Expect Resistance to interact with save modifiers by adding 1d4 to a saving throw before or after the roll; that behavior should not exist for this spell version. | PASS | This spell does not populate `saveModifiers` or `savePenalty` data; the save-modifier systems are separate and unused here. |

# Shocking Grasp Scenarios

Source references:
- `docs/spells/reference/level-0/shocking-grasp.md`
- `public/data/spells/level-0/shocking-grasp.json`
- `src/utils/character/spellAbilityFactory.ts`
- `src/hooks/combat/useTargetValidator.ts`
- `src/systems/spells/targeting/TargetResolver.ts`
- `src/hooks/useAbilitySystem.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/commands/effects/DamageCommand.ts`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/hooks/combat/useTurnManager.ts`
- `src/systems/combat/reactions/OpportunityAttackSystem.ts`
- `src/utils/combatUtils.ts`

## Spell components worth exercising

- 1 action casting time, verbal and somatic only, no material component
- Touch range with a melee spell attack delivery
- Line of sight is required
- Valid targets are creatures only
- No ally, enemy, or neutral relation filter is declared
- Lightning damage on hit
- Cantrip scaling at character levels 5, 11, and 17
- The hit rider suppresses opportunity attacks until the start of the target's next turn
- Combat and noncombat use should be checked separately because the reviewed runtime is combat-oriented
- The reference text mentions the metal-armor advantage rider, but the structured JSON/runtime slice does not currently model it

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Shocking Grasp at a visible creature within 5 feet. | PASS | The spell is modeled as a 1-action touch spell with `attackType: melee`, `range.type: touch`, and creature-only targeting. |
| Attempt to cast it beyond touch range; the cast should be rejected. | PASS | The validator rejects the target as out of range for the 5-foot touch limit. |
| Attempt to cast it through blocked line of sight; the cast should be rejected. | PASS | `lineOfSight: true` is set, and the targeting layer rejects blocked or unavailable sight lines. |
| Attempt to target an object or empty ground; the cast should be rejected. | PASS | The spell only allows creatures, so object and ground clicks are rejected instead of being coerced into legal targets. |
| Cast it on an ally, an enemy, and a neutral creature. | PASS | No ally/enemy/self relation filter is declared, so any legal creature target remains valid regardless of team relation. |
| Check for the spell's advantage against a target wearing metal armor. | PASS | `CombatCharacter.hasMetalArmor` now gives the combat attack path a bounded material signal, and `WeaponAttackCommand` grants Shocking Grasp advantage only for melee spell attacks against that flagged target. |
| Resolve the melee spell attack as a hit. | PASS | The shared combat event path carries hit results forward, and the hit-conditioned damage/status rows resolve only on a confirmed hit. |
| Resolve the melee spell attack as a miss. | BLOCKED | This review did not find a Shocking Grasp-specific miss executor in the spell slice, so the miss path is not proven end to end here. |
| On a hit, deal 1d8 Lightning damage. | PASS | The damage row is Lightning damage with 1d8 base dice, and the shared damage command handles it normally. |
| Resolve the cantrip at character levels 5, 11, and 17. | PASS | The scaling row is present and records 2d8, 3d8, and 4d8 Lightning damage at the listed tiers. |
| Hit a target with Lightning resistance, immunity, or vulnerability. | PASS | `DamageCommand` routes Lightning damage through the shared resistance/vulnerability calculator, so the normal half/zero/double outcomes apply. |
| On a hit, apply the opportunity-attack suppression rider. | PASS | The JSON models a 1-round `Opportunity Attacks Suppressed` status condition, and the combat opportunity-attack system reads that condition name directly. |
| Let the target start its next turn and expect the suppression rider to expire. | PASS | `useTurnManager` ticks round-based status effects and mirrored conditions together, so the 1-round rider clears at the next turn boundary. |
| Use Shocking Grasp in combat. | PASS | The spell has a normal action cost, combat command path, and hit-conditioned runtime effects, so it is usable in the reviewed combat slice. |
| Use Shocking Grasp outside combat or in exploration mode. | BLOCKED | The reviewed runtime surface is combat-oriented, and no separate noncombat execution bridge was found for this spell. |

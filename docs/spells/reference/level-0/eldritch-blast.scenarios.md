# Eldritch Blast Scenario Review

## Components that matter

- Range: 120 feet
- Targeting: multi-target beam spell
- Valid targets: creatures and objects
- Line of sight: required
- Casting time: 1 action
- Components: verbal, somatic
- Damage: 1d10 force on a hit
- Attack type: ranged spell attack
- Scaling: 2 beams at level 5, 3 at level 11, 4 at level 17
- Beam assignment: same target or different targets
- Beam resolution: sequential, with a separate attack roll for each beam

## Scenarios

| Scenario | Current result | Evidence-based read |
|---|---|---|
| A visible creature is within 120 feet and is selected as the only beam target. | PASS | `TargetResolver` accepts ranged targets in range with line of sight, and the damage engine applies Force damage once a hit-conditioned target reaches `DamageCommand`. |
| A creature is 121 feet away. | PASS | `TargetResolver` rejects targets beyond the spell's range before command execution. |
| A creature is in range but line of sight is blocked. | PASS | `TargetResolver` enforces `lineOfSight: true` and rejects blocked sight lines. |
| An ally creature is chosen instead of an enemy. | PASS | The spell does not carry an ally/enemy restriction, so current target validation allows any creature in range and sight. |
| An object in range is chosen as the target. | PASS | `SpellAttackCommand` now preserves object `selectedSpellTargets` as spell-attack instances and records a structured `SpellObjectImpact` for Eldritch Blast's 1d10 Force object hit. Focused proof: `npx vitest run src/commands/factory/__tests__/SpellCommandFactorySpellAttack.test.ts`. |
| A 5th-level caster has two legal beam targets available. | PASS | `resolveScalableNumber` and `resolveMultiTargetIds` expand the target count to 2 at level 5, and `SpellAttackCommand` now resolves the two selected creature refs as separate beam attack instances in deterministic order. |
| A 5th-level caster tries to place both beams on the same creature. | PASS | Beam allocation now consumes `instanceAllocation.assignment: same_or_different_targets`; when a level-5 Eldritch Blast cast provides one selected creature ref, the executor pads the missing beam by repeating that selected target instead of de-duplicating away the second beam. |
| Each beam should make its own ranged spell attack, including hit/miss separation and cover-sensitive attack-roll behavior. | PASS | Beam spells now loop attack instances sequentially, rolling and logging `spellAttackInstanceIndex`, `spellAttackInstanceCount`, and independent hit/miss data for each beam before applying hit-conditioned Force damage only to beams that hit. |

## Bottom line

Eldritch Blast's target selection proves range, line of sight, and beam-count scaling, and the spell-attack bridge now preserves beam instances through execution. Creature and object beam targets each roll a separate ranged spell attack; duplicate beams can stack on one creature, split targets resolve in order, and misses skip only that beam's hit-conditioned damage.


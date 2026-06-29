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
| An object in range is chosen as the target. | FAIL | `useAbilitySystem` converts the cast into `CombatCharacter[]` targets for `SpellCommandFactory`; object selections can be recorded in `selectedSpellTargets`, but `DamageCommand` only resolves creature targets, so the object branch does not execute. |
| A 5th-level caster has two legal beam targets available. | PASS | `resolveScalableNumber` and `resolveMultiTargetIds` expand the target count to 2 at level 5, and the execution path preserves a deterministic beam order. |
| A 5th-level caster tries to place both beams on the same creature. | FAIL | The current target-id builder de-duplicates creature IDs, so the runtime can choose multiple creatures but cannot assign two beam instances to one target. |
| Each beam should make its own ranged spell attack, including hit/miss separation and cover-sensitive attack-roll behavior. | FAIL | The spell pipeline currently reaches `DamageCommand` with hit-conditioned damage and emits a post-hit event, but there is no dedicated spell-attack command that rolls one attack per beam. |

## Bottom line

Eldritch Blast's target selection proves range, line of sight, and beam-count scaling, but the current runtime still flattens beam instances into a de-duplicated creature target list. That means the spell cannot yet express duplicate beams on one target, and it still lacks a per-beam ranged spell attack bridge before damage resolves.


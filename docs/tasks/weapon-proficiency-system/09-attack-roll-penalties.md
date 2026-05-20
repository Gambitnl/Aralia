# Task 09: Prove Non-Proficiency Penalties on Attack Rolls

Status: verified; regression coverage added
Last reviewed: 2026-05-19

## Current reading

This is no longer best read as an unimplemented combat behavior. The current code path appears to already remove proficiency bonus from non-proficient weapon attacks.

The remaining task was to add focused regression coverage and then mark the behavior as verified, which has now been completed.

## Verified current state

Manual repo verification on 2026-03-12 confirmed that src/utils/combat/combatUtils.ts already tags generated weapon abilities with isProficient.

Follow-up repo verification on 2026-05-19 found the final attack modifier gate in src/commands/factory/AbilityCommandFactory.ts: when no explicit attackBonus override exists, WeaponAttackCommand computes proficiencyBonus from this.ability.isProficient ? pb : 0 before calling resolveAttack().

The same 2026-05-19 pass also found the opportunity attack path in src/hooks/combat/useActionExecutor.ts using weaponAbility.isProficient ? proficiency bonus : 0.

Regression tests have been added to prove a non-proficient weapon attack omits proficiency bonus from the attack roll. The tests cover both the command-side weapon attack path (\`src/commands/factory/__tests__/AbilityCommandFactory.test.ts\`) and the opportunity attack path (\`src/hooks/combat/__tests__/useActionExecutor.test.ts\`).

## Concrete remaining question

This task is complete and serves as a historical verification note.

## Scope

This file should no longer be read as combat integration has not started at all. It is specifically about turning the discovered implementation into protected behavior through targeted tests and keeping the combat-log explanation aligned with the permissive weapon-proficiency rule.

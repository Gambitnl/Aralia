# Magic Stone Scenarios

Source references:
- `docs/spells/reference/level-0/magic-stone.md`
- `public/data/spells/level-0/magic-stone.json`

## Spell components worth exercising

- 1 bonus action, verbal and somatic only
- Touch range with self targeting
- One to three pebbles imbued per casting
- Projectile allocation with sequential resolution
- The stone can be thrown or used with a sling
- Thrown range is 60 feet; sling use is normal weapon behavior
- Another creature can use the pebble
- Attack roll and damage should use the caster's spellcasting ability modifier
- Damage is bludgeoning and listed as 1d6 plus spellcasting ability modifier
- Hit or miss, the used pebble ends
- Recasting ends any remaining pebbles early
- Duration is 1 minute, with no concentration and no scaling

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Magic Stone on yourself as a bonus action using only verbal and somatic components. | PASS | The reference and JSON both say `bonus_action`, `touch`, `self`, verbal true, somatic true, and material false. |
| Imbue one, two, or three pebbles from a single casting. | PASS | The structured targeting block records a projectile instance allocation with `baseCount: 3` and sequential resolution. |
| Try to imbue a fourth pebble from the same casting. | PASS | The runtime bridge caps the projectile allocation at three and does not create a fourth pebble. |
| Try to cast Magic Stone on a creature or object instead of self. | FAIL | The targeting data is self-only, and object eligibility is marked not applicable. |
| Throw an empowered pebble at a target within 60 feet. | PASS | The spell text explicitly gives a 60-foot thrown range. |
| Sling an empowered pebble instead of throwing it by hand. | PASS | The structured attack augment names both `pebble` and `sling` as valid weapon types. |
| Let another creature use the pebble and expect the caster's spellcasting ability modifier to apply to the attack roll. | PASS | Magic Stone now stores caster-linked temporary pebble enchantments that the normal weapon attack path can consume even when another creature attacks with the pebble. Focused proof: `npx vitest run src/commands/factory/__tests__/MagicStoneBridge.test.ts`. |
| Let another creature use the pebble and expect the caster's spellcasting ability modifier to apply to damage. | PASS | The temporary pebble enchantment preserves the source caster's spellcasting modifier for Magic Stone damage. Focused proof: `npx vitest run src/commands/factory/__tests__/MagicStoneBridge.test.ts`. |
| Resolve a pebble hit and expect 1d6 bludgeoning plus the caster's spellcasting ability modifier. | PASS | The Magic Stone bridge routes the empowered pebble through the weapon attack path with the spell's 1d6 bludgeoning damage and caster modifier. Focused proof: `npx vitest run src/commands/factory/__tests__/MagicStoneBridge.test.ts`. |
| Resolve a pebble miss and expect only that pebble to end. | PASS | The one-shot Magic Stone enchantment is consumed on hit or miss, removing only the used spell-created pebble and its matching temporary weapon enchantment. Focused proof: `npx vitest run src/commands/factory/__tests__/MagicStoneBridge.test.ts`. |
| Recast Magic Stone while pebbles remain and expect the earlier pebbles to end early. | PASS | Recasting Magic Stone clears prior Magic Stone pebbles and replaces them with the current casting's three empowered projectiles. Focused proof: `npx vitest run src/commands/factory/__tests__/MagicStoneBridge.test.ts`. |
| Check the duration row for a one-minute, non-concentration cantrip with no scaling. | PASS | The reference and JSON both record a 1 minute duration, concentration false, and no higher-level scaling. |
| Hand an imbued pebble off, drop it, or leave it unattended and expect the repo to track a pebble-held state. | BLOCKED | Current evidence shows the attack handoff text, but no pebble object-state model or held/unattended lifecycle is exposed in the reviewed files. |

# Friends Scenarios

Source references:
- `docs/spells/reference/level-0/friends.md`
- `public/data/spells/level-0/friends.json`
- `src/commands/effects/StatusConditionCommand.ts`
- `src/commands/factory/SpellCommandFactory.ts`
- `src/systems/spells/ai/AISpellArbitrator.ts`
- `src/utils/character/savingThrowUtils.ts`

## Spell components worth exercising

- 1 action casting time with no reaction trigger
- 10-foot ranged, line-of-sight, single-target casting
- Creatures only, with no willingness requirement
- Wisdom save that applies Charmed on a failed save
- 1 minute duration with concentration
- Auto-success branches for non-humanoids, creatures fighting the caster or allies, and repeat casting within 24 hours
- Spell ends early if the target takes damage or if the caster attacks, deals damage, or forces a saving throw
- Target learns the spell charmed them when it ends
- Mechanical arbitration only, with no AI prompt

## Scenario matrix

| Scenario | Current result | Notes |
| --- | --- | --- |
| Cast Friends on a visible humanoid creature within 10 feet and let the Wisdom save resolve normally. | PASS | The reference and JSON both define a one-creature, 10-foot, line-of-sight cast that applies `Charmed` through the status-condition path. `SpellCommandFactory` routes mechanical spells directly into that path. |
| Try to target a creature beyond 10 feet or without line of sight. | FAIL | The spell is explicitly ranged 10 feet with `lineOfSight: true`. |
| Try to target an object, door, or other non-creature. | FAIL | Friends lists `validTargets: creatures` only. |
| Cast Friends on an allied humanoid that is not fighting you. | PASS | The spell does not exclude allies, so a humanoid ally remains a valid creature target for the normal save-and-charm flow. |
| Cast Friends on a hostile humanoid that is fighting you or your allies. | PASS | `StatusConditionCommand` now consumes the Friends auto-success branch before rolling the save; opposing-team targets receive a `fighting_caster_or_allies` override log and no Charmed condition. Focused proof: `npx vitest run --dir src commands/effects/__tests__/StatusConditionCommand.test.ts`. |
| Cast Friends on a non-humanoid creature. | PASS | Friends now checks the target creature types before the save; known non-humanoids receive a `not_humanoid` auto-success result and do not receive Charmed. |
| Recast Friends on the same creature within 24 hours. | PASS | Friends casts now record target-side `spellMemory` for the caster and spell, and an unexpired memory causes the `recently_affected_by_spell` auto-success branch on recast. |
| Expect Friends to grant Charisma-check advantage or an explicit attitude-shift state instead of only Charmed. | FAIL | Neither the reference nor the JSON defines a check bonus or attitude state; the mechanical payload is only `Charmed`. |
| While Friends is active, the target takes damage or the caster makes an attack roll, deals damage, or forces a save, and the spell should end early. | PASS | Friends now uses the shared concentration cleanup path for all reviewed early-end triggers: target damage, caster damage, caster spell/weapon attack rolls, and caster-forced saving throws. Focused proof covers each trigger and confirms the Charmed state is removed with awareness recorded. |
| When Friends ends, the target should know it was charmed by the caster. | PASS | Friends status effects now carry `socialLifecycle` metadata; when concentration cleanup removes the charm, the target receives `socialAwareness` with `post_charm_awareness` and the caster id. |
| Cast Friends in exploration or a conversation scene and expect deterministic mechanical resolution rather than AI DM arbitration. | PASS | `arbitrationType` is `mechanical`, `aiContext` is empty, and `AISpellArbitrator` short-circuits mechanical spells without model-driven adjudication. |
| Maintain Friends for its full 1-minute duration while concentrating. | PASS | The reference and JSON both record a 1-minute concentration spell, and `SpellCommandFactory` starts concentration for concentration spells. |

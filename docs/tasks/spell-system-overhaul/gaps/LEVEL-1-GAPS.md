# Level 1 Gaps Summary

> Note: This file is parsed by `useSpellGateChecks` to build a “known gaps” set. Spell IDs mentioned here (bolded names or backticked IDs) tell the glossary/spell gate to treat missing cards/JSON as “gap” instead of “fail” while the underlying mechanics are still being implemented. Vitest also mocks this import in `useSpellGateChecks.test.ts`, so keeping the file present and structured in markdown is required for tests and gate logic.

All Level 1 batches completed and validated. Schema is clean; these are engine/integration gaps and missing features needed for full behavior fidelity.

## High-Impact Engine Gaps
- **Material costs/consumption enforcement**: Chromatic Orb (50 gp diamond), Identify/Find Familiar incense, Detect Evil and Good/Protection from Evil and Good components, etc., are not checked or decremented in casting flow.
- **Vision/obscurement model**: Faerie Fire advantage only if target is visible; Fog Cloud/Color Spray/Darkness interactions with darkvision and targeting are not enforced; Sanctuary/Command/Compelled Duel rely on target selection logic respecting visibility/taunt rules.
- **Behavior/charm/deception logic**: Charm Person “knows after,” Heroism fear immunity, Command options, Sanctuary (redirect attacks), Dissonant Whispers forced movement, and Hex ability-check disadvantage all need combat/AI hooks beyond save resolution.
- **Ongoing/area ticks**: Tasha’s Caustic Brew ongoing acid until washed, Wrathful Smite frightened repeat saves, Hail of Thorns AoE on hit, Hunter’s Mark/Hex damage riders per hit, Cloud of Daggers/Moonbeam-like ticks (sleep/similar) require consistent “enter/turn” handling and on-hit riders.
- **Forced movement and concentration links**: Thunderous Smite push/prone, Thorn Whip pull, Dissonant Whispers reaction move, Command: Approach/Flee/Halt need forced-move handling with opportunity attacks/collision rules; Wrathful Smite and Hunter’s Mark concentration link to target not enforced across retargeting.
- **Summons/familiars**: Find Familiar delivery/telepathy/shared senses and Find Steed mounting/teleporting self-only spells to the steed are not wired into action economy or combat initiative; dismissal/resummon costs not tracked.
- **Buff/debuff stacking and duration UI**: Bless/Bane/Guidance/Resistance, Hex/Hunter’s Mark, and Shield of Faith need clear UI and stacking rules; bonus-action concentration swaps (Hex/Hunter’s Mark) aren’t enforced.
- **Ritual casting flow**: Ritual time and component bypass are not represented in casting UI/action selection; exploration-time costs (Comprehend Languages, Detect Magic) need non-combat handling.
- **Movement/action-economy triggers**: Feather Fall reaction on falling, Shield reaction on being hit/targeted, Hellish Rebuke reaction on taking damage, Expeditious Retreat bonus-action Dash per turn—need robust trigger plumbing.

## Commands Validated
- `npx tsx scripts/regenerate-manifest.ts`
- `npm run validate`
- `npx tsx scripts/check-spell-integrity.ts`

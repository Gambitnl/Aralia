# Spell Attack Roll Riders Tracker

## Purpose

This bucket tracks spell effects that change how attack rolls work without
creating a real condition.

That includes:
- disadvantage on the target's next attack
- disadvantage on attacks against the target
- attack penalties that last while a spell is active
- one-shot attack riders that disappear after the next attack is made

This bucket exists because the old condition model was too blunt. Some spells
change attack rolls, but the game does not treat that change as a named
condition.

## Current Status

- Active
- Frostbite has been migrated out of the condition bucket and into this lane
- The glossary spell card now has a dedicated attack-roll rider pill row
- The runtime spell engine now has a dedicated `ATTACK_ROLL_MODIFIER` effect
  path

## Key Subtypes

1. Outgoing rider on the target's own attacks
- Example: Frostbite
- Truth shape:
  - the spell damages the target on a failed save
  - the target's next weapon attack is made with disadvantage

2. Incoming rider on attacks against the target
- Example family: spells and features that make a creature harder to hit
- Truth shape:
  - the target becomes harder to attack
  - the rider should sit on the creature being attacked, not as a fake condition

3. Duration-based rider
- Example family: ongoing attack penalties while a spell lasts
- Truth shape:
  - the rider stays active until a duration ends
  - it may move with the caster or stay anchored, depending on the spell

4. Bonus / penalty rider
- Example family: spells that shift attack rolls by a number or a die roll
- Truth shape:
  - the rider changes the roll itself, not the target's condition list

## Exact Field Map

The spell truth layer already has the pieces for this bucket. The point of this
map is to make those pieces easy to read and harder to mistake for a real
condition.

### JSON Shape

- `effect.type = ATTACK_ROLL_MODIFIER`
- `effect.attackRollModifier.modifier`
- `effect.attackRollModifier.direction`
- `effect.attackRollModifier.attackKind`
- `effect.attackRollModifier.consumption`
- `effect.attackRollModifier.duration`
- `effect.attackRollModifier.dice`
- `effect.attackRollModifier.value`
- `effect.attackRollModifier.attackerFilter`
- `effect.attackRollModifier.notes`
- `effect.damage` when the rider is bundled with damage instead of standing
  alone

### Structured Markdown Labels

- `Attack Roll Modifier`
- `Attack Roll Direction`
- `Attack Roll Kind`
- `Attack Roll Consumption`
- `Attack Roll Duration`
- `Attack Roll Dice`
- `Attack Roll Value`
- `Attack Roll Attacker Filter`
- `Attack Roll Notes`

### Compatibility Note

`Save Outcome` still uses the shared legacy enum name `negates_condition` in
the current schema. That label is kept for compatibility with the rest of the
spell system; it does not mean the effect is a real condition.

## Current Inventory

- `frostbite` - migrated here from the condition bucket

## Progress Log

- Frostbite stopped being classified as a condition
- The spell JSON now uses `ATTACK_ROLL_MODIFIER`
- The structured markdown now exposes the attack-roll rider fields directly
- The glossary spell card now shows attack-roll rider pills separately from real
  conditions
- The condition bucket tracker and inventory were updated to remove Frostbite
- The runtime rider command now uses the live combat turn state when stamping
  attack-roll rider effects, instead of reading a stale game-state field
- The ability attack path now declares its ranged/melee branch before it uses it,
  which keeps rider collection and attack resolution in the same order as the
  attack loop itself

## Remaining Work

- Inventory other spells that should live in this bucket
- Split the bucket into clearer subgroups once more rider patterns show up
- Decide whether incoming and outgoing riders need separate display labels in
  the glossary gate checker
- Check whether any existing runtime active effects still encode rider behavior
  as a fake condition
- Expand the runtime review for attack-roll riders to confirm the state stamp fix
  is visible in the spell gate checker for live selected spells

## Open Questions

- Should the structured markdown keep the rider fields inline with the spell
  body, or should the runtime JSON become the main truth source for attack-roll
  riders?
- Do we need separate labels for "next attack" versus "first attack" in the
  shared spell gate checker?
- Which other spells in the corpus belong here once the inventory pass is
  expanded?
- Should the runtime review be split further into "state stamp" and
  "attack-order" subbuckets if more rider bugs appear?

## Gate Checker Coverage

- The glossary spell gate checker now has a dedicated `Attack Roll Riders Runtime Review` block.
- That block compares the structured rider rows in the spell markdown against the live spell JSON the glossary actually renders.
- It should be the first place we look when a spell needs rider mechanics that are not real conditions.

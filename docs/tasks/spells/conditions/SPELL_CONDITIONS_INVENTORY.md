# Spell Conditions Inventory

Last Updated: 2026-04-14

This inventory lists the current condition-bearing spell surface in the corpus.
It separates runtime status-condition effects from the structured markdown
`Conditions Applied` row so the bucket can tell the difference between real
mechanics and condition-adjacent wording.

## Summary Counts

- Runtime JSON spells with at least one `STATUS_CONDITION` effect: `47`
- Total runtime status-condition effects: `56`
- Structured markdown files with a `Conditions Applied` row: `56`
- Shared overlap: `46`
- Runtime-only condition spells missing the markdown row: `0`
- Markdown-only `Conditions Applied` rows without a runtime status-condition effect:
  `10`

## Standard Status Conditions Used By Spells

### Blinded

- `Blinding Smite`
- `Blindness/Deafness`
- `Color Spray`
- `Feign Death`
- `Wall of Light`
- `Wall of Sand`

### Charmed

- `Animal Friendship`
- `Charm Monster`
- `Charm Person`
- `Compulsion`
- `Dominate Beast`
- `Fast Friends`
- `Friends`
- `Hypnotic Pattern`
- `Incite Greed`

### Frightened

- `Fear`
- `Wrathful Smite`

### Grappled

- `Grasping Vine`

### Ignited

- `Searing Smite`

### Incapacitated

- `Banishment`
- `Feign Death`
- `Haste`
- `Hypnotic Pattern`

### Invisible

- `Greater Invisibility`

### Paralyzed

- `Hold Person`

### Poisoned

- `Ray of Sickness`
- `Stinking Cloud`

### Prone

- `Grease`
- `Sleet Storm`
- `Thunderous Smite`
- `Tidal Wave`
- `Wrath of Nature`

### Restrained

- `Ensnaring Strike`
- `Entangle`
- `Evard's Black Tentacles`
- `Snare`
- `Telekinesis`
- `Watery Sphere`
- `Web`
- `Wrath of Nature`

### Unconscious

- `Sleep`

## Custom Condition Labels

These are mechanically meaningful labels that are not standard 5e condition names.

### Bane

- `Bane`

### Banished

- `Banishment`

### Blessed

- `Bless`

### Confused

- `Confusion`

### Disadvantage On Attacks Vs. Caster

- `Chill Touch`

### Muddled Thoughts

- `Synaptic Static`

### No Healing

- `Chill Touch`

### Prone, Incapacitated

- `Tasha's Hideous Laughter`

### Reactions Suppressed

- `Arms of Hadar`
- `Shocking Grasp`

## Markdown `Conditions Applied` Rows Without Runtime Status Conditions

These files still have a `Conditions Applied` row, but the runtime spell JSON does
not currently carry a `STATUS_CONDITION` effect for them.

- `calm-emotions` - `None`
- `compelled-duel` - `None`
- `crown-of-madness` - `Charmed`
- `enthrall` - `None`
- `faerie-fire` - `None`
- `gust-of-wind` - `None`
- `invisibility` - `Invisible`
- `pyrotechnics` - `Blinded`
- `silence` - `Deafened`
- `suggestion` - `Charmed`

## Runtime Status Conditions Missing The Markdown Row

These spells already apply a runtime status condition, but the structured markdown
file still lacks a matching `Conditions Applied` row.

- None live after the 2026-04-29 pass.

Closed during the 2026-04-29 pass:
- `chill-touch` - `No Healing`, `Disadvantage on attacks vs. caster`
- `friends` - `Charmed`
- `searing-smite` - `Ignited`
- `shocking-grasp` - `Reactions Suppressed`
- `snare` - `Restrained`

Frostbite moved out of this inventory because `Frostbitten` is not a real
condition. It is now tracked as an attack-roll rider.

## Notes

- The spell corpus currently uses `12` standard status names from the shared
  condition enum.
- The remaining `4` standard names in code are not yet used by the spell corpus:
  - `Deafened`
  - `Exhaustion`
  - `Petrified`
  - `Stunned`
- `Conditions Applied` is now required by the structured markdown plan. This
  inventory records the current reality so the bucket can normalize the row
  without losing which spells are true condition effects.

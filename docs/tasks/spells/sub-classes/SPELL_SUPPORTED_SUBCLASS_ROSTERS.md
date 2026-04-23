# Spell Supported Subclass Rosters

Last Updated: 2026-04-12

## Purpose

This file records the currently supported subclass rosters for the spell
`Sub-Classes` bucket.

These rosters are the allowlists that the normalized spell layers should use:

1. structured spell markdown `Sub-Classes`
2. runtime spell JSON `subClasses`

The canonical snapshot remains intact even when it shows broader subclass access.
This file only answers which subclass labels are currently supported by the repo.

## Rule

Use the live class glossary subclass content as the current supported-subclass
surface.

That means:

- if a subclass has a dedicated class-subclass glossary entry in
  `public\\data\\glossary\\entries\\classes\\*_subclasses`, it is supported
- if a subclass only exists as a spell-access label in canonical/reference
  surfaces, it is not yet supported for normalized structured `.md` or JSON

## Supported Rosters

### Artificer
- `Alchemist`
- `Armorer`
- `Artillerist`
- `Battle Smith`

### Barbarian
- `Path of the Berserker`
- `Path of the Wild Heart`
- `Path of the World Tree`
- `Path of the Zealot`

### Bard
- `College of Dance`
- `College of Glamour`
- `College of Lore`
- `College of Valor`

### Cleric
- `Life Domain`
- `Light Domain`
- `Trickery Domain`
- `War Domain`

### Druid
- `Circle of the Land`
- `Circle of the Moon`
- `Circle of the Sea`
- `Circle of the Stars`

### Fighter
- `Battle Master`
- `Champion`
- `Eldritch Knight`
- `Psi Warrior`

### Monk
- `Warrior of Mercy`
- `Warrior of Shadow`
- `Warrior of the Elements`
- `Warrior of the Open Hand`

### Paladin
- `Oath of Devotion`
- `Oath of Glory`
- `Oath of the Ancients`
- `Oath of Vengeance`

### Ranger
- `Beast Master`
- `Fey Wanderer`
- `Gloom Stalker`
- `Hunter`

### Rogue
- `Arcane Trickster`
- `Assassin`
- `Soulknife`
- `Thief`

### Sorcerer
- `Aberrant Mind`
- `Clockwork Soul`
- `Draconic Sorcery`
- `Wild Magic`

### Warlock
- `Archfey Patron`
- `Celestial Patron`
- `Fiend Patron`
- `Great Old One Patron`

### Wizard
- `Abjurer`
- `Diviner`
- `Evoker`
- `Illusionist`

## Normalization Consequences

When syncing spell `Sub-Classes`:

- keep supported and repeated-base canonical subclass lines intact
- do not retain unsupported subclass labels in the stored canonical snapshot
- move only supported subclass labels into structured `.md` and runtime JSON
- remove unsupported subclass labels from normalized spell layers
- still normalize away repeated-base entries if the base class already appears in
  `Classes`
- if every canonical subclass entry is repeated-base only, use:
  - `Sub-Classes: Folded into Classes`

## Open Question

This file uses the current repo-supported roster, not a broader canonical or
tabletop-complete roster.

If the project later expands subclass support, update this file first and then
rerun the spell `Sub-Classes` bucket against the broader allowlist.

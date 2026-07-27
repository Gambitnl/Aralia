# Magic item attunement and character boons

## What this covers

How a magic item's mechanical benefits reach the player character, and how
attunement gates those benefits. This is the path from item data → equipped
character → final ability scores, armor class, and attack rolls.

## Current state (found 2026-07-22)

The **enforcement machinery is built and tested, but the item data never fills
the fields it reads**, so magic items are inert in play. This is a data-and-
plumbing gap, not a missing system.

### What works
- Attunement limit: `ATTUNE_ITEM` / `UNATTUNE_ITEM` in
  `src/state/reducers/characterReducer.ts` enforce the D&D 3-item-per-character
  limit, keyed on the flat `item.requiresAttunement` / `item.isAttuned` fields.
- Ability-score boons: `calculateFinalAbilityScores` in
  `src/utils/character/statUtils.ts` applies `item.statBonuses` and
  `item.statOverrides`, and skips any item that `requiresAttunement` while not
  `isAttuned`.
- Armor class: `calculateArmorClass` caps an unattuned magic shield's bonus to +2.
- Weapon bonus: `partyStatUtils.ts` adds `magicProperties.magicalBonus` to weapon
  attack and damage.

### What is missing
- Of 810 generated glossary items, **zero** carry `statBonuses`, `statOverrides`,
  `magicalBonus`, `acBonus`, `abilityModifier`, `charges`, or the flat
  `requiresAttunement`. No hand-authored item carries `statBonuses` /
  `statOverrides` either.
- The 194 "magic" generated items carry only prose plus a **nested**
  `magicProperties.attunement.required: true`.
- Field-shape mismatch: the runtime reads the **flat** `requiresAttunement` /
  `isAttuned`, while the ingested data writes the **nested**
  `magicProperties.attunement.required`. Nothing bridges the two.
- Result: Gauntlets of Ogre Power grant no Strength, Belt of Giant Strength and
  Amulet of Health do nothing, +1 weapons add no bonus, and none of these can be
  attuned through the built flow (so they never count against the 3-item limit).

## Capabilities

### Attunement enforcement per character
The 3-item attunement limit and attune/unattune actions. Built.

### Ability score boons from equipment
Equipped items raise or set ability scores (e.g. Gauntlets of Ogre Power set
Strength to 19), gated on attunement. Machinery exists; no item data populates it.

### Weapon magical attack bonuses
A +1/+2/+3 weapon adds its bonus to attack and damage rolls. Machinery exists;
no item data populates it.

### Ingested mechanical field population
The glossary ingest (`scripts/ingestPhbGlossary.ts`) should parse each magic
item's rules text into the mechanical fields the runtime reads, instead of
emitting prose only.

### Unified attunement field shape
Settle on one attunement representation (flat vs nested) so the reducer, stat
math, and ingested data all agree.

## Related code
- `src/utils/character/statUtils.ts`
- `src/utils/character/partyStatUtils.ts`
- `src/state/reducers/characterReducer.ts`
- `src/types/magicItems.ts`, `src/types/items.ts`
- `src/data/items/generatedGlossaryItems.ts`
- `scripts/ingestPhbGlossary.ts`

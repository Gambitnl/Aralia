# Magic item attunement and character boons

## What this covers

How a magic item's mechanical benefits reach the player character, and how
attunement gates those benefits. This is the path from item data → equipped
character → final ability scores, armor class, and attack rolls.

## Current state (data gap closed 2026-08-06)

The item data now fills the fields the machinery reads. The ingest captures
the structured 5eTools mechanic fields, and the registry generator emits the
runtime fields. Magic items grant their boons in play.

### What the 2026-08-06 slice added
- The ingest (`scripts/ingestPhbGlossary.ts`) reads `bonusWeapon`, `bonusAc`,
  `ability`, `charges`, `recharge`, and `rechargeAmount` into `itemMetadata`.
- The registry (`scripts/generateItemRegistry.ts`) emits the flat
  `requiresAttunement`, `statOverrides`, `statBonuses`,
  `magicProperties.magicalBonus`, `armorClassBonus`, and
  `magicProperties.charges`.
- The registry infers a wear slot for wondrous accessories from the item name
  (`inferAccessorySlot`). Without a slot, `EQUIP_ITEM` cannot place the item.
- `calculateArmorClass` now adds `armorClassBonus` from equipped non-shield
  items, gated on attunement. This makes Ring and Cloak of Protection work.
- Guard test: `src/data/items/__tests__/generatedItemMechanics.test.ts` pins
  representative items and registry-wide counts.

### Still open after the slice
- No machinery spends or recharges wand/staff charges. The data is now there.
- Spell-attack and save-DC bonuses (Rod of the Pact Keeper) are not ingested.
- The saving-throw half of Ring/Cloak of Protection does not apply.
- `magicalBonus` reaches main-hand weapon rolls only; Wraps of Unarmed Power
  sit in the Wrists slot and do not boost unarmed strikes.
- In-game eyeball of the attunement panel and boon flow is pending.

## Old state (found 2026-07-22, now fixed)

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

<!-- aralia-backlog-walked: {"source":"docs/tasks/backlog-retirement/RETIREMENT_LEDGER.md","path":"docs/tasks/magic-items/magic-item-boons-and-attunement.md","sha256WithoutMarker":"82a91143677002e213b3d6ceb0183a707a702dd0fa57d2cb3d0855b5641212a6","markedAtUtc":"2026-08-09T20:24:24.669Z"} -->

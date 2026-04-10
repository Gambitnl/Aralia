# Spell Class And Subclass Variations

This document inventories the class and subclass labels currently present in the
spell corpus.

It compares two sources:

- spell JSON files under `public\data\spells`
- structured spell markdown under `docs\spells\reference`

The goal is not to decide which labels are correct here. The goal is to make the
current variation surface visible so later normalization work can operate from an
explicit review list instead of scattered spell files.

Generated from the live corpus on `2026-04-01`.

## Summary

- JSON base classes: `9`
- JSON subclass strings: `97`
- Structured markdown base classes: `9`
- Structured markdown subclass strings: `98`

The markdown surface has one extra malformed entry:

- `None`

## Base Classes

Shared between JSON and structured markdown:

- `Artificer`
- `Bard`
- `Cleric`
- `Druid`
- `Paladin`
- `Ranger`
- `Sorcerer`
- `Warlock`
- `Wizard`

## JSON Subclass Variations

### `Artificer`

- `Artificer - Battle Smith (Legacy)`

### `Artificer (Legacy)`

- `Artificer (Legacy) - Battle Smith (Legacy)`

### `Cleric`

- `Cleric - Arcana Domain (SCAG)`
- `Cleric - Blood Domain (TCSR)`
- `Cleric - Community Domain (HCS)`
- `Cleric - Death Domain (DMG)`
- `Cleric - Festus Domain`
- `Cleric - Forge Domain (XGtE)`
- `Cleric - Grave Domain (XGtE)`
- `Cleric - Keeper Domain (BoET)`
- `Cleric - Knowledge Domain`
- `Cleric - Knowledge Domain (Legacy)`
- `Cleric - Light Domain`
- `Cleric - Moon Domain (TCSR)`
- `Cleric - Nature Domain (PHB)`
- `Cleric - Night Domain (HCS)`
- `Cleric - Order Domain (TCoE)`
- `Cleric - Peace Domain`
- `Cleric - Peace Domain (TCOE)`
- `Cleric - Peace Domain (TCoE)`
- `Cleric - Shadow Domain (BoET)`
- `Cleric - Tempest Domain (PHB)`
- `Cleric - Trickery Domain`
- `Cleric - Twilight Domain`
- `Cleric - Twilight Domain (TCOE)`
- `Cleric - Twilight Domain (TCoE)`
- `Cleric - War Domain`

### `Cleric (Legacy)`

- `Cleric (Legacy) - Arcana Domain`
- `Cleric (Legacy) - Community Domain`
- `Cleric (Legacy) - Hunt Domain`
- `Cleric (Legacy) - Knowledge Domain (Legacy)`
- `Cleric (Legacy) - Life Domain (Legacy)`
- `Cleric (Legacy) - Light Domain (Legacy)`

### `Druid`

- `Druid - Circle of Shadows (BoET)`
- `Druid - Circle of Spores (TCoE)`
- `Druid - Circle of the Hive`
- `Druid - Circle of the Hive (HGtMH1)`
- `Druid - Circle of the Sea`
- `Druid - Circle of Wildfire (TCOE)`
- `Druid - Circle of Wildfire (TCoE)`

### `Druid (Legacy)`

- `Druid (Legacy) - Circle of Wildfire`

### `Illrigger`

- `Illrigger - Architect of Ruin`

### `Paladin`

- `Paladin - Oath of Castigation`
- `Paladin - Oath of Conquest (XGtE)`
- `Paladin - Oath of Devotion`
- `Paladin - Oath of Glory`
- `Paladin - Oath of Redemption (XGtE)`
- `Paladin - Oath of Revelry`
- `Paladin - Oath of the Ancients`
- `Paladin - Oath of the Crown (SCAG)`
- `Paladin - Oath of the Harvest (HGtMH1)`
- `Paladin - Oath of the Open Sea (TCSR)`
- `Paladin - Oath of the River (OTTG)`
- `Paladin - Oath of the Spelldrinker`
- `Paladin - Oath of the Watchers (TCoE)`
- `Paladin - Oath of Vengeance`
- `Paladin - Oathbreaker (DMG)`

### `Paladin (Legacy)`

- `Paladin (Legacy) - Oath of the Harvest`
- `Paladin (Legacy) - Oath of the River`
- `Paladin (Legacy) - Oath of the Spelldrinker`
- `Paladin (Legacy) - Oath of the Watchers`
- `Paladin (Legacy) - Oath of Vengeance (Legacy)`
- `Paladin (Legacy) - Oath of Zeal (Legacy)`

### `Ranger`

- `Ranger - Fey Wanderer`
- `Ranger - Gloom Stalker`
- `Ranger - Grim Harbinger`

### `Rogue`

- `Rogue - Highway Rider`

### `Sorcerer`

- `Sorcerer - Aberrant Sorcery`
- `Sorcerer - Clockwork Sorcery`
- `Sorcerer - Crimson Sorcery`
- `Sorcerer - Draconic Sorcery`

### `Sorcerer (Legacy)`

- `Sorcerer (Legacy) - Crimson Dynasty (2014)`

### `Warlock`

- `Warlock - Archfey Patron`
- `Warlock - Celestial Patron`
- `Warlock - Fiend Patron`
- `Warlock - Future You Patron`
- `Warlock - Great Fool Patron`
- `Warlock - Great Old One Patron`
- `Warlock - Horned King Patron`
- `Warlock - Lantern Patron (OTTG)`
- `Warlock - Mother of Sorrows (BoET)`
- `Warlock - The Fathomless (TCoE)`
- `Warlock - The Genie (TCoE)`
- `Warlock - The Great Fool (2014)`
- `Warlock - The Hexblade (XGTE)`
- `Warlock - The Hexblade (XGtE)`
- `Warlock - The Many`
- `Warlock - The Predator`
- `Warlock - The Predator (HWT)`
- `Warlock - The Undead (VRGtR)`
- `Warlock - The Undying (SCAG)`

### `Warlock (Legacy)`

- `Warlock (Legacy) - The Celestial`
- `Warlock (Legacy) - The Celestial (Legacy)`
- `Warlock (Legacy) - The Fathomless`
- `Warlock (Legacy) - The Horned King (2014)`
- `Warlock (Legacy) - The Many`
- `Warlock (Legacy) - The Parasite`

## Structured Markdown Only Variations

These currently appear in the structured `.md` surface but not in the JSON surface:

- `Cleric - Life Domain`
- `None`

Interpretation:

- `Cleric - Life Domain` is canonical evidence still preserved in some structured
  markdown files, but it has been normalized out of JSON where the base class
  `Cleric` is already present.
- `None` is malformed data and should be treated as a cleanup/normalization target,
  not a real subclass label.

## JSON Only Variations

These currently appear in the JSON surface but not in the structured `.md` surface:

- `Cleric - Knowledge Domain (Legacy)`

Interpretation:

- this is likely either a structured markdown omission or a normalization mismatch
  that should be reviewed spell-by-spell before any global cleanup

## Clear Normalization Targets

These are the most obvious variant families that may deserve a later dedicated
normalization pass:

- suffix casing:
  - `TCoE` vs `TCOE`
  - `XGtE` vs `XGTE`

- legacy-prefix duplication:
  - `Warlock (Legacy) - The Celestial`
  - `Warlock (Legacy) - The Celestial (Legacy)`

- plain vs suffixed domain labels:
  - `Cleric - Peace Domain`
  - `Cleric - Peace Domain (TCoE)`
  - `Cleric - Peace Domain (TCOE)`

- malformed/non-variant values:
  - `None`

## Recommendation

Use this document as the review surface before any class/subclass normalization work.

The safest later order would be:

1. remove malformed values like `None`
2. decide casing normalization rules for source tags like `TCoE` / `TCOE`
3. decide whether repeated-base subclass lines should stay canonical-only evidence
   or be allowed in normalized spell JSON
4. only then collapse true duplicate variants

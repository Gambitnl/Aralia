# Spell Structured vs Canonical Report

This report compares the validator-facing structured spell markdown block to the raw canonical snapshot stored lower in the same file.

Generated: 2026-04-30T08:24:16.536Z
Markdown files scanned: 459
Spell files compared: 456
Total mismatches: 249
Grouped mismatch buckets: 7

This report does not arbitrate which side is correct. It only surfaces where the structured Aralia spell data and the copied canonical snapshot are not currently identical.

## Grouped Mismatches

### structured-vs-canonical / Description

- Kind: `value-mismatch`
- Occurrences: 76
- Distinct spells: 76
- Sample spells: blade-ward, booming-blade, create-bonfire, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, green-flame-blade, guidance
- Sample findings:
  - Blade Ward records Description differently in the structured block and the canonical snapshot.
  - Booming Blade records Description differently in the structured block and the canonical snapshot.
  - Create Bonfire records Description differently in the structured block and the canonical snapshot.
  - Dancing Lights records Description differently in the structured block and the canonical snapshot.
  - Druidcraft records Description differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Sub-Classes

- Kind: `missing-structured-field`
- Occurrences: 69
- Distinct spells: 69
- Sample spells: bane, command, cure-wounds, divine-favor, guiding-bolt, heroism, mage-hand, mind-sliver, ray-of-frost, sacred-flame
- Sample findings:
  - Mage Hand is missing structured Sub-Classes data that exists in the canonical snapshot.
  - Mind Sliver is missing structured Sub-Classes data that exists in the canonical snapshot.
  - Ray of Frost is missing structured Sub-Classes data that exists in the canonical snapshot.
  - Sacred Flame is missing structured Sub-Classes data that exists in the canonical snapshot.
  - Bane records Sub-Classes differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Higher Levels

- Kind: `value-mismatch`
- Occurrences: 53
- Distinct spells: 53
- Sample spells: booming-blade, eldritch-blast, green-flame-blade, lightning-lure, primal-savagery, shillelagh, spare-the-dying, starry-wisp, thorn-whip, true-strike
- Sample findings:
  - Booming Blade records Higher Levels differently in the structured block and the canonical snapshot.
  - Eldritch Blast records Higher Levels differently in the structured block and the canonical snapshot.
  - Green-Flame Blade records Higher Levels differently in the structured block and the canonical snapshot.
  - Lightning Lure records Higher Levels differently in the structured block and the canonical snapshot.
  - Primal Savagery is missing structured Higher Levels data that exists in the canonical snapshot.

### structured-vs-canonical / Range/Area

- Kind: `value-mismatch`
- Occurrences: 26
- Distinct spells: 26
- Sample spells: cordon-of-arrows, detect-evil-and-good, detect-magic, detect-poison-and-disease, dragons-breath, elementalism, entangle, grease, phantasmal-force, sword-burst
- Sample findings:
  - Elementalism records Range/Area differently in the structured block and the canonical snapshot.
  - Sword Burst records Range/Area differently in the structured block and the canonical snapshot.
  - Detect Evil and Good records Range/Area differently in the structured block and the canonical snapshot.
  - Detect Magic records Range/Area differently in the structured block and the canonical snapshot.
  - Detect Poison and Disease records Range/Area differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Classes

- Kind: `value-mismatch`
- Occurrences: 21
- Distinct spells: 21
- Sample spells: aura-of-life, aura-of-purity, bigbys-hand, circle-of-power, conjure-volley, elementalism, green-flame-blade, mending, staggering-smite, true-strike
- Sample findings:
  - Elementalism records Classes differently in the structured block and the canonical snapshot.
  - Green-Flame Blade records Classes differently in the structured block and the canonical snapshot.
  - Mending records Classes differently in the structured block and the canonical snapshot.
  - True Strike records Classes differently in the structured block and the canonical snapshot.
  - Aura of Life has structured Classes data, but the canonical snapshot does not currently expose a comparable Classes value.

### structured-vs-canonical / Components

- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: arcane-sword, feather-fall, soul-cage
- Sample findings:
  - Feather Fall records Components differently in the structured block and the canonical snapshot.
  - Soul Cage records Components differently in the structured block and the canonical snapshot.
  - Arcane Sword records Components differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Duration

- Kind: `value-mismatch`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: blade-ward
- Sample findings:
  - Blade Ward records Duration differently in the structured block and the canonical snapshot.


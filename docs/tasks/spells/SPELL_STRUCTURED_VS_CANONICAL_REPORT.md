# Spell Structured vs Canonical Report

This report compares the validator-facing structured spell markdown block to the raw canonical snapshot stored lower in the same file.

Generated: 2026-04-23T22:34:21.977Z
Markdown files scanned: 459
Spell files compared: 409
Total mismatches: 380
Grouped mismatch buckets: 9

This report does not arbitrate which side is correct. It only surfaces where the structured Aralia spell data and the copied canonical snapshot are not currently identical.

## Grouped Mismatches

### structured-vs-canonical / Range/Area

- Kind: `value-mismatch`
- Occurrences: 144
- Distinct spells: 144
- Sample spells: alarm, arms-of-hadar, burning-hands, color-spray, create-or-destroy-water, detect-evil-and-good, detect-magic, detect-poison-and-disease, entangle, faerie-fire
- Sample findings:
  - Alarm records Range/Area differently in the structured block and the canonical snapshot.
  - Arms of Hadar records Range/Area differently in the structured block and the canonical snapshot.
  - Burning Hands records Range/Area differently in the structured block and the canonical snapshot.
  - Color Spray records Range/Area differently in the structured block and the canonical snapshot.
  - Create or Destroy Water records Range/Area differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Sub-Classes

- Kind: `value-mismatch`
- Occurrences: 65
- Distinct spells: 65
- Sample spells: bane, command, cure-wounds, detect-thoughts, divine-favor, guiding-bolt, heroism, protection-from-evil-and-good, sanctuary, shield-of-faith
- Sample findings:
  - Bane records Sub-Classes differently in the structured block and the canonical snapshot.
  - Command records Sub-Classes differently in the structured block and the canonical snapshot.
  - Cure Wounds records Sub-Classes differently in the structured block and the canonical snapshot.
  - Divine Favor is missing structured Sub-Classes data that exists in the canonical snapshot.
  - Guiding Bolt records Sub-Classes differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Casting Time

- Kind: `value-mismatch`
- Occurrences: 52
- Distinct spells: 52
- Sample spells: alarm, comprehend-languages, detect-magic, detect-poison-and-disease, divine-smite, ensnaring-strike, feather-fall, find-familiar, hail-of-thorns, hellish-rebuke
- Sample findings:
  - Alarm records Casting Time differently in the structured block and the canonical snapshot.
  - Comprehend Languages records Casting Time differently in the structured block and the canonical snapshot.
  - Detect Magic records Casting Time differently in the structured block and the canonical snapshot.
  - Detect Poison and Disease records Casting Time differently in the structured block and the canonical snapshot.
  - Divine Smite records Casting Time differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Description

- Kind: `value-mismatch`
- Occurrences: 51
- Distinct spells: 51
- Sample spells: arcane-eye, aura-of-life, aura-of-purity, banishment, blight, control-water, enlarge-reduce, enthrall, evards-black-tentacles, fabricate
- Sample findings:
  - Enlarge/Reduce records Description differently in the structured block and the canonical snapshot.
  - Enthrall records Description differently in the structured block and the canonical snapshot.
  - Arcane Eye records Description differently in the structured block and the canonical snapshot.
  - Aura of Life records Description differently in the structured block and the canonical snapshot.
  - Aura of Purity records Description differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Higher Levels

- Kind: `value-mismatch`
- Occurrences: 24
- Distinct spells: 24
- Sample spells: charm-monster, conjure-minor-elementals, conjure-woodland-beings, dominate-beast, freedom-of-movement, giant-insect, grasping-vine, ice-storm, mordenkainens-private-sanctum, phantasmal-killer
- Sample findings:
  - Charm Monster records Higher Levels differently in the structured block and the canonical snapshot.
  - Conjure Minor Elementals records Higher Levels differently in the structured block and the canonical snapshot.
  - Conjure Woodland Beings records Higher Levels differently in the structured block and the canonical snapshot.
  - Dominate Beast records Higher Levels differently in the structured block and the canonical snapshot.
  - Freedom of Movement records Higher Levels differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Classes

- Kind: `missing-canonical-field`
- Occurrences: 17
- Distinct spells: 17
- Sample spells: aura-of-life, aura-of-purity, bigbys-hand, circle-of-power, conjure-volley, mass-cure-wounds, mislead, modify-memory, passwall, staggering-smite
- Sample findings:
  - Aura of Life has structured Classes data, but the canonical snapshot does not currently expose a comparable Classes value.
  - Aura of Purity records Classes differently in the structured block and the canonical snapshot.
  - Staggering Smite has structured Classes data, but the canonical snapshot does not currently expose a comparable Classes value.
  - Bigby's Hand records Classes differently in the structured block and the canonical snapshot.
  - Circle of Power has structured Classes data, but the canonical snapshot does not currently expose a comparable Classes value.

### structured-vs-canonical / Duration

- Kind: `value-mismatch`
- Occurrences: 17
- Distinct spells: 17
- Sample spells: arcane-sword, conjure-elemental, contagion, glyph-of-warding, hallow, hold-monster, infernal-calling, leomunds-secret-chest, maelstrom, transmute-rock
- Sample findings:
  - Glyph of Warding records Duration differently in the structured block and the canonical snapshot.
  - Leomund's Secret Chest records Duration differently in the structured block and the canonical snapshot.
  - Conjure Elemental records Duration differently in the structured block and the canonical snapshot.
  - Contagion records Duration differently in the structured block and the canonical snapshot.
  - Hallow records Duration differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Material Component

- Kind: `value-mismatch`
- Occurrences: 7
- Distinct spells: 7
- Sample spells: arcane-sword, divination, feather-fall, raise-dead, reincarnate, soul-cage, stoneskin
- Sample findings:
  - Feather Fall records Material Component differently in the structured block and the canonical snapshot.
  - Divination records Material Component differently in the structured block and the canonical snapshot.
  - Stoneskin records Material Component differently in the structured block and the canonical snapshot.
  - Raise Dead records Material Component differently in the structured block and the canonical snapshot.
  - Reincarnate records Material Component differently in the structured block and the canonical snapshot.

### structured-vs-canonical / Components

- Kind: `value-mismatch`
- Occurrences: 3
- Distinct spells: 3
- Sample spells: arcane-sword, feather-fall, soul-cage
- Sample findings:
  - Feather Fall records Components differently in the structured block and the canonical snapshot.
  - Soul Cage records Components differently in the structured block and the canonical snapshot.
  - Arcane Sword records Components differently in the structured block and the canonical snapshot.


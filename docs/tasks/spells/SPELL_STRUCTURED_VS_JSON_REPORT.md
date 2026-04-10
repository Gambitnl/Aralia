# Spell Structured vs JSON Report

This report compares the validator-facing structured spell markdown block to the live runtime spell JSON that the glossary renders.

Generated: 2026-04-09T10:52:47.278Z
Markdown files scanned: 459
Spell files compared: 412
Total mismatches: 177
Grouped mismatch buckets: 7

This is the second parity phase in the spell-truth workflow. It shows where runtime JSON still lags behind the structured markdown after canonical review work has already happened.

## Grouped Mismatches

### structured-vs-json / Range/Area

- Kind: `value-mismatch`
- Occurrences: 61
- Distinct spells: 61
- Sample spells: aura-of-vitality, clairvoyance, conjure-animals, conjure-minor-elementals, conjure-woodland-beings, crusaders-mantle, leomunds-tiny-hut, pass-without-trace, sending, skywrite
- Sample findings:
  - Pass without Trace records Range/Area differently in the structured markdown block and the runtime spell JSON.
  - Skywrite is missing structured Range/Area data that still exists in the runtime spell JSON.
  - Aura of Vitality records Range/Area differently in the structured markdown block and the runtime spell JSON.
  - Clairvoyance records Range/Area differently in the structured markdown block and the runtime spell JSON.
  - Conjure Animals records Range/Area differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Sub-Classes

- Kind: `missing-json-field`
- Occurrences: 45
- Distinct spells: 45
- Sample spells: aid, alter-self, bless, chromatic-orb, compelled-duel, detect-magic, fog-cloud, purify-food-and-drink, tashas-hideous-laughter, thunderwave
- Sample findings:
  - Bless still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Chromatic Orb still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Compelled Duel still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Detect Magic still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Fog Cloud records Sub-Classes differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Description

- Kind: `value-mismatch`
- Occurrences: 34
- Distinct spells: 34
- Sample spells: command, cure-wounds, darkness, disguise-self, enlarge-reduce, find-traps, greater-restoration, nystuls-magic-aura, sleep, slow
- Sample findings:
  - Command records Description differently in the structured markdown block and the runtime spell JSON.
  - Cure Wounds records Description differently in the structured markdown block and the runtime spell JSON.
  - Disguise Self records Description differently in the structured markdown block and the runtime spell JSON.
  - Sleep records Description differently in the structured markdown block and the runtime spell JSON.
  - Darkness records Description differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Duration

- Kind: `value-mismatch`
- Occurrences: 17
- Distinct spells: 17
- Sample spells: conjure-elemental, contagion, hallow, hold-monster, infernal-calling, leomunds-secret-chest, maelstrom, pyrotechnics, transmute-rock, transport-via-plants
- Sample findings:
  - Pyrotechnics records Duration differently in the structured markdown block and the runtime spell JSON.
  - Leomund's Secret Chest records Duration differently in the structured markdown block and the runtime spell JSON.
  - Conjure Elemental records Duration differently in the structured markdown block and the runtime spell JSON.
  - Contagion records Duration differently in the structured markdown block and the runtime spell JSON.
  - Hallow records Duration differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Higher Levels

- Kind: `missing-structured-field`
- Occurrences: 8
- Distinct spells: 8
- Sample spells: bigbys-hand, bones-of-the-earth, create-undead, crown-of-stars, elemental-bane, enervation, mass-suggestion, wall-of-thorns
- Sample findings:
  - Elemental Bane is missing structured Higher Levels data that still exists in the runtime spell JSON.
  - Bigby's Hand is missing structured Higher Levels data that still exists in the runtime spell JSON.
  - Enervation is missing structured Higher Levels data that still exists in the runtime spell JSON.
  - Bones of the Earth is missing structured Higher Levels data that still exists in the runtime spell JSON.
  - Create Undead records Higher Levels differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Casting Time

- Kind: `value-mismatch`
- Occurrences: 7
- Distinct spells: 7
- Sample spells: counterspell, dream-of-the-blue-veil, feather-fall, hellish-rebuke, legend-lore, mirage-arcane, shield
- Sample findings:
  - Feather Fall records Casting Time differently in the structured markdown block and the runtime spell JSON.
  - Hellish Rebuke records Casting Time differently in the structured markdown block and the runtime spell JSON.
  - Shield records Casting Time differently in the structured markdown block and the runtime spell JSON.
  - Counterspell records Casting Time differently in the structured markdown block and the runtime spell JSON.
  - Legend Lore records Casting Time differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Material Component

- Kind: `value-mismatch`
- Occurrences: 5
- Distinct spells: 5
- Sample spells: magic-mouth, melfs-acid-arrow, true-seeing, vitriolic-sphere, wall-of-ice
- Sample findings:
  - Magic Mouth records Material Component differently in the structured markdown block and the runtime spell JSON.
  - Melf's Acid Arrow records Material Component differently in the structured markdown block and the runtime spell JSON.
  - Vitriolic Sphere still has structured Material Component data, but the runtime spell JSON does not currently store a comparable Material Component value.
  - True Seeing records Material Component differently in the structured markdown block and the runtime spell JSON.
  - Wall of Ice records Material Component differently in the structured markdown block and the runtime spell JSON.


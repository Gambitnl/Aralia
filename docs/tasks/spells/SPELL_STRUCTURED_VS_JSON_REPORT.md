# Spell Structured vs JSON Report

This report compares the validator-facing structured spell markdown block to the live runtime spell JSON that the glossary renders.

Generated: 2026-04-30T08:25:02.239Z
Markdown files scanned: 459
Spell files compared: 459
Total mismatches: 93
Grouped mismatch buckets: 3

This is the second parity phase in the spell-truth workflow. It shows where runtime JSON still lags behind the structured markdown after canonical review work has already happened.

## Grouped Mismatches

### structured-vs-json / Sub-Classes

- Kind: `missing-json-field`
- Occurrences: 57
- Distinct spells: 57
- Sample spells: aid, alter-self, bless, chromatic-orb, compelled-duel, detect-magic, fog-cloud, purify-food-and-drink, tashas-hideous-laughter, thunderwave
- Sample findings:
  - Bless still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Chromatic Orb still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Compelled Duel still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Detect Magic still has structured Sub-Classes data, but the runtime spell JSON does not currently store a comparable Sub-Classes value.
  - Fog Cloud records Sub-Classes differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Description

- Kind: `value-mismatch`
- Occurrences: 35
- Distinct spells: 35
- Sample spells: chill-touch, command, cure-wounds, darkness, disguise-self, enlarge-reduce, find-traps, shocking-grasp, sleep, snare
- Sample findings:
  - Chill Touch records Description differently in the structured markdown block and the runtime spell JSON.
  - Shocking Grasp records Description differently in the structured markdown block and the runtime spell JSON.
  - Command records Description differently in the structured markdown block and the runtime spell JSON.
  - Cure Wounds records Description differently in the structured markdown block and the runtime spell JSON.
  - Disguise Self records Description differently in the structured markdown block and the runtime spell JSON.

### structured-vs-json / Classes

- Kind: `value-mismatch`
- Occurrences: 1
- Distinct spells: 1
- Sample spells: snare
- Sample findings:
  - Snare records Classes differently in the structured markdown block and the runtime spell JSON.


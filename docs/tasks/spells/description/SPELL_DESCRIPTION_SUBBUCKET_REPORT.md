# Spell Description Subbucket Report

This report splits the Description bucket by phase so the project can see the current residue clearly after the canonical-side parser fix.

Generated: 2026-04-29T08:12:44.561Z

## Canonical -> Structured

- Mismatches: 96
- Sub-buckets: 3

### Canonical Extra Rules Detail

- Bucket ID: `canonical-extra-rules-detail`
- Count: 46
- Rationale: Canonical prose still contains meaningful operational detail that the structured Description does not fully carry yet.
- Sample spells: acid-splash, booming-blade, chill-touch, create-bonfire, dancing-lights, druidcraft, eldritch-blast, elementalism, fire-bolt, frostbite

### Real Prose Drift

- Bucket ID: `real-prose-drift`
- Count: 35
- Rationale: The structured Description still uses materially different prose than the copied canonical Description.
- Sample spells: blade-ward, enlarge-reduce, enthrall, guidance, light, mending, message, minor-illusion, produce-flame, shape-water

### Higher-Level Text Still Inline Or Missing

- Bucket ID: `higher-level-text-still-inline-or-missing`
- Count: 15
- Rationale: Canonical prose still carries scaling text inline, so the Description mismatch is partly a Description-versus-Higher-Levels split problem.
- Sample spells: absorb-elements, bigbys-hand, catapult, elemental-bane, enervation, infernal-calling, mass-cure-wounds, storm-sphere, summon-greater-demon, tashas-caustic-brew

## Structured -> JSON

- Mismatches: 35
- Sub-buckets: 2

### Wording Shift Still Needs Review

- Bucket ID: `wording-shift-still-needs-review`
- Count: 18
- Rationale: The runtime Description and structured Description still differ in wording in a way that is not pure formatting noise.
- Sample spells: command, contingency, create-homunculus, cure-wounds, darkness, enlarge-reduce, guards-and-wards, nystuls-magic-aura, scrying, slow

### Real Runtime Drift

- Bucket ID: `real-runtime-drift`
- Count: 17
- Rationale: The runtime spell JSON still carries materially different Description prose than the structured layer.
- Sample spells: chill-touch, disguise-self, disintegrate, find-traps, greater-restoration, harm, ottos-irresistible-dance, shocking-grasp, sleep, snare


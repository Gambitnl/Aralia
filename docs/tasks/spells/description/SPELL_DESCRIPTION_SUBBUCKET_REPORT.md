# Spell Description Subbucket Report

This report splits the Description bucket by phase so the project can see the current residue clearly after the canonical-side parser fix.

Generated: 2026-04-05T22:17:41.722Z

## Canonical -> Structured

- Mismatches: 51
- Sub-buckets: 3

### Real Prose Drift

- Bucket ID: `real-prose-drift`
- Count: 30
- Rationale: The structured Description still uses materially different prose than the copied canonical Description.
- Sample spells: arcane-eye, banishment, blight, enlarge-reduce, enthrall, evards-black-tentacles, fabricate, freedom-of-movement, polymorph, vitriolic-sphere

### Canonical Extra Rules Detail

- Bucket ID: `canonical-extra-rules-detail`
- Count: 13
- Rationale: Canonical prose still contains meaningful operational detail that the structured Description does not fully carry yet.
- Sample spells: aura-of-life, aura-of-purity, circle-of-power, conjure-volley, control-water, control-winds, greater-restoration, mordenkainens-private-sanctum, sickening-radiance, watery-sphere

### Higher-Level Text Still Inline Or Missing

- Bucket ID: `higher-level-text-still-inline-or-missing`
- Count: 8
- Rationale: Canonical prose still carries scaling text inline, so the Description mismatch is partly a Description-versus-Higher-Levels split problem.
- Sample spells: bigbys-hand, infernal-calling, mass-cure-wounds, modify-memory, planar-binding, storm-sphere, summon-greater-demon, wall-of-light

## Structured -> JSON

- Mismatches: 34
- Sub-buckets: 2

### Wording Shift Still Needs Review

- Bucket ID: `wording-shift-still-needs-review`
- Count: 18
- Rationale: The runtime Description and structured Description still differ in wording in a way that is not pure formatting noise.
- Sample spells: command, contingency, create-homunculus, cure-wounds, darkness, enlarge-reduce, guards-and-wards, nystuls-magic-aura, scrying, slow

### Real Runtime Drift

- Bucket ID: `real-runtime-drift`
- Count: 16
- Rationale: The runtime spell JSON still carries materially different Description prose than the structured layer.
- Sample spells: bones-of-the-earth, disguise-self, disintegrate, find-traps, greater-restoration, harm, ottos-irresistible-dance, sleep, soul-cage, tensers-transformation


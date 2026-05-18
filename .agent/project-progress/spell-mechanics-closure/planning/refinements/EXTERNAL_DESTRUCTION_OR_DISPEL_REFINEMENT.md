# External Destruction Or Dispel Refinement

Status: planning refinement
Created: 2026-05-14

This file narrows the broad `external_destruction_or_dispel` candidate group from
`MECHANICS_SUBFAMILY_CLASSIFICATION-conditional-aftermath.md`. The classifier grouped
these rows together because each one mentions destruction, dispelling, physical
movement, or an outside event that changes spell lifetime. That shared language is
not enough to justify one schema change. The goal of this refinement is to split the
group into closure-ready mechanic shapes before any spell/template edits happen.

## Source Rows

These rows were pulled from the focused conditional/aftermath subfamily classification:

- `dispel-magic::conditional_ending`
- `glyph-of-warding::conditional_ending`
- `swift-quiver::conditional_ending`
- `swift-quiver::aftermath_or_memory`
- `drawmijs-instant-summons::conditional_ending`
- `druid-grove::conditional_ending`
- `magic-jar::aftermath_or_memory`
- `soul-cage::conditional_ending`
- `sequester::conditional_ending`
- `symbol::conditional_ending`

## Refined Subfamilies

### Dispel Resolution Model

Rows:

- `dispel-magic::conditional_ending`

Why this is separate:

- This is not just a spell ending when dispelled. It is the spell that performs
  dispelling, with automatic success against lower-level spell effects and a caster
  ability check against higher-level effects.
- Closing it likely needs a reusable dispel-resolution model rather than an
  end-cleanup or object-destruction value.

Recommended next state:

- Keep this as its own new-model batch.
- Inspect all spells that remove magic, suppress magic, counter magic, or end magical
  effects before adding the model, so the schema vocabulary is not built around only
  `dispel-magic`.

### Glyph Movement Or Trigger Lifetime

Rows:

- `glyph-of-warding::conditional_ending`
- `symbol::conditional_ending`

Why these fit together:

- Both spells create a placed glyph whose runtime lifetime depends on a physical
  placement rule and a triggered state.
- Both appear to need structured fields for "ends harmlessly if moved too far from
  the casting location" and "triggered effect has its own post-trigger duration."

Recommended next state:

- This is the safest next closure batch from this refinement.
- Before editing, inspect canonical prose and current JSON for both spells.
- Reuse existing ward/alarm/trigger surfaces if they already express placement
  anchors and trigger consumption; otherwise add a narrow placed-effect lifecycle
  field rather than a generic destruction/dispel field.

### Spell-Linked Object Destruction Or Use Count

Rows:

- `drawmijs-instant-summons::conditional_ending`
- `soul-cage::conditional_ending`

Why these fit together:

- Both involve a spell-linked object whose loss, destruction, or exhausted use count
  ends or meaningfully changes the spell state.
- The important runtime shape is "this spell is tied to an external anchor/resource,"
  not simply "the object was destroyed."

Recommended next state:

- Treat as a new-model batch only after checking whether existing resource-cost,
  component, created-object, or sustain-requirement fields can carry the anchor.
- Do not mix this with glyph movement rules; the runtime questions are different.

### Created Object Cleanup At Spell End

Rows:

- `swift-quiver::aftermath_or_memory`
- `magic-jar::aftermath_or_memory`

Why these fit together:

- Both describe an object-specific consequence when the spell ends.
- `swift-quiver` created ammunition disintegrates. `magic-jar` destroys the container
  when the spell ends. These may both fit the existing `effects[].endCleanup[]`
  structure if that surface can identify created or linked objects cleanly.

Recommended next state:

- Consider as a narrow reuse batch if canonical review confirms the current
  `endCleanup` model can express both without hiding the difference between created
  ammunition and a required spell container.
- Keep `swift-quiver::conditional_ending` separate because its possession-based
  ending is not the same as its ammunition cleanup.

### Complex Multi-Effect Lifecycle

Rows:

- `druid-grove::conditional_ending`

Why this is separate:

- The spell has independently removable ward effects, a whole-spell ending condition
  when all effects are gone, and animated tree behavior when the spell ends.
- That combination crosses ward lifecycle, subeffect removal, and controlled/animated
  entity cleanup.

Recommended next state:

- Defer until the corpus-level model for multi-effect ward lifecycles and animated
  terrain/entity cleanup is designed.
- Do not use this row as the first example for a new generic lifecycle schema.

### Custom Or Arbitration-Aware Ending

Rows:

- `sequester::conditional_ending`

Why this is separate:

- The spell has normal damage-based ending behavior plus a bespoke visible-within-one-mile
  condition that is hard to express as a common runtime primitive without overfitting.
- This may belong in a structured custom-condition or AI-arbitration-aware field,
  depending on the broader arbitration model.

Recommended next state:

- Keep this as a special new-model or arbitration-aware batch.
- Do not close it as a generic destruction/dispel row unless the schema can preserve
  both the damage ending and the unusual visibility condition.

## Recommended Next Batch

Start with **Glyph Movement Or Trigger Lifetime**:

- It closes two open rows with one coherent model.
- It is narrower than the full external-destruction group.
- It is less risky than the dispel-resolution, multi-effect lifecycle, or arbitration
  rows.
- It should reveal whether existing ward/alarm/trigger schema surfaces are sufficient
  before adding a new placed-effect lifecycle field.

Before editing any schema or spell files, inspect:

- `docs/spells/reference/level-3*/glyph-of-warding.md`
- `public/data/spells/level-3*/glyph-of-warding.json`
- `docs/spells/reference/level-7*/symbol.md`
- `public/data/spells/level-7*/symbol.json`
- relevant template shards for ward/alarm/trigger and conditional ending fields
- current manual-review override rows for the two finding ids


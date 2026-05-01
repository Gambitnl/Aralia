# Spell Casting Time Bucket Tracker

Last Updated: 2026-04-28

## Bucket Purpose

This tracker exists for the `Casting Time` spell-truth bucket.

The bucket is responsible for two separate comparisons:

1. `canonical -> structured`
2. `structured -> json`

This matters because the glossary spell card renders from runtime spell JSON, not
from the structured markdown block. A spell is not fully covered just because the
canonical snapshot and structured header were compared successfully.

## Current Status

- canonical -> structured:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `0`
  - current reading: complete for the current report; ritual-inline, trigger-footnote,
    casing, and pluralization display residue are audit-normalized, and the one
    true special-timing spell (`plant-growth`) was updated in structured markdown
    and runtime JSON
- structured -> json:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `0`
  - current reading: complete for the current report after applying the same
    split-facts normalization to runtime comparison
- glossary gate checker:
  - canonical -> structured `Casting Time Review`: implemented
  - structured -> json `Structured -> JSON` subsection inside `Casting Time Review`: implemented

## Current Interpretation

### Canonical -> Structured

This side is mainly about raw source display strings such as:

- `1 Minute Ritual`
- `1 Reaction *`
- `1 Bonus Action *`

The structured spell layer already splits some of those ideas apart into:

- base casting time
- ritual flag
- reaction/bonus-action trigger context

So the canonical-side bucket is mostly:

- accepted normalization
- source-shape residue

not broad evidence of wrong base casting times.

### Structured -> JSON

This side answers the runtime question:

- does the structured casting-time layer still differ from the live spell JSON that
  the glossary actually renders?

The old `7`-spell runtime residue set was audit-shape residue:

- reaction trigger wording living in structured text while runtime JSON keeps only
  normalized base timing
- longer-casting display wording differences
- possible true implementation drift on a smaller residue subset

Former representative runtime sample spells:

- `counterspell`
- `dream-of-the-blue-veil`
- `feather-fall`
- `hellish-rebuke`
- `legend-lore`
- `mirage-arcane`
- `shield`

## Key Mismatch Families

### 1. Ritual Inline Display

Examples:

- `alarm`
- `comprehend-languages`
- `detect-magic`
- `find-familiar`

Canonical pages append `Ritual` inline to the casting-time string.
The structured layer and runtime JSON keep ritual as a separate fact.

Current reading:

- canonical -> structured: resolved as audit normalization on `2026-04-28`
- structured -> json: usually model/display boundary, not real runtime drift

Current handling:

- the canonical audit strips a trailing `Ritual` token from the comparable
  `Casting Time` value only when the structured block already has `Ritual: true`
- this preserves the raw canonical snapshot while comparing the split structured
  fact that Aralia actually owns: default casting time
- ritual-expanded timing remains derived from `Ritual: true` plus the default
  casting time; it is not yet a first-class structured markdown or JSON field

### 2. Trigger Footnote Display

Examples:

- `feather-fall`
- `hellish-rebuke`
- `shield`

Canonical pages use `*` or compact trigger shorthand.
Structured markdown may keep richer wording, while runtime JSON keeps normalized
base timing and stores trigger meaning elsewhere.

Current reading:

- canonical -> structured: source-display residue
- structured -> json: likely model/display boundary unless the runtime JSON truly
  loses the trigger meaning needed by the spell

### 3. Canonical Suffix Display

Examples:

- longer-casting and special-display cases where the canonical source adds extra
  timing prose after the base value

Current reading:

- canonical -> structured: source-display residue
- structured -> json: needs spell-by-spell review before being called real drift

### 4. True Timing Drift

This is the narrow category to reserve for cases where:

- the structured casting-time value does not reduce cleanly to the runtime JSON
- and the difference is not explainable as ritual-inline display
- and the difference is not explainable as trigger-footnote formatting

Current status:

- still possible on part of the `7`-spell runtime set
- not yet proven to dominate the bucket

## Per-Phase Plan

### Phase 1: Canonical -> Structured

Status: complete in the current generated report.

What the gate checker now shows:

- problem statement
- classification
- review verdict
- structured value
- canonical value
- base timing fact
- ritual and ritual-expanded timing when relevant

Remaining work:

- policy review only for whether Plant Growth-style alternate casting costs should
  gain richer first-class structured markdown fields later

### Phase 2: Structured -> JSON

Status: complete in the current generated report.

What the gate checker now shows:

- what is wrong
- review verdict
- classification
- structured header value
- current JSON base casting time
- current JSON ritual flag
- current JSON ritual cast time
- whether the structured header still matches runtime JSON

Remaining work:

- none for the current report's Casting Time group

## Progress Log

### 2026-04-28

- closed the ritual-inline display subbucket for canonical -> structured audit
  comparison
- changed the canonical audit so `1 Minute Ritual` compares as `1 Minute` only
  when the structured spell already records `Ritual: true`
- verified `alarm` no longer reports a Casting Time mismatch; its remaining
  mismatch is Range/Area and belongs to another bucket
- reran the corpus audit and reduced canonical Casting Time residue from `52`
  to `20`
- confirmed `0` remaining Casting Time mismatches contain a canonical `Ritual`
  token after normalization
- closed trigger-footnote display, bonus-action footnote display, long-cast
  pluralization, and casing-only display residue by normalizing the audit around
  split base timing facts
- updated `plant-growth` from `1 action`/ritual timing to canonical `special`
  casting time in both structured markdown and runtime JSON
- reran canonical and runtime audits; both current reports now have `0` Casting
  Time mismatch groups

### 2026-04-03

- confirmed the bucket is two-phase rather than canonical-only
- confirmed the canonical-side live count is `52`
- confirmed the runtime-side live count is `7`
- confirmed the gate checker originally covered canonical -> structured only
- added a separate `Structured -> JSON` subsection inside the gate checker’s
  `Casting Time Review`
- strengthened the casting-time review language so the bucket now says what is
  wrong in plain terms rather than only naming a residue class
- documented the bucket in the shared spell-truth docs

## Remaining Work

- decide whether `Exploration Cost Value` / `Exploration Cost Unit` should become
  official structured markdown fields. `plant-growth` now records them in markdown
  and JSON, but the markdown parity tooling does not yet compare those labels.
- keep watch for new Casting Time mismatches as other agents regenerate reports
- decide whether any runtime JSON timing shape should expand to carry richer
  trigger-aware casting-time semantics later

## Open Questions / Model Gaps

1. Should runtime spell JSON ever store richer reaction/bonus-action trigger wording
   directly in the casting-time lane, or should that remain elsewhere in the spell model?

2. Should ritual-expanded cast time remain a derived fact only, or should it gain a
   first-class structured/runtime field later?

3. Should the bucket eventually distinguish:
   - base timing aligned
   - trigger semantics aligned
   - ritual semantics aligned
   instead of keeping those all inside one casting-time review surface?

4. Should alternate special casting costs, such as Plant Growth's action combat
   mode and 8-hour enrichment mode, become first-class structured markdown fields?

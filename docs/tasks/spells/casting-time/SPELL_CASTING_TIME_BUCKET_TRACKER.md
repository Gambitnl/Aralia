# Spell Casting Time Bucket Tracker

Last Updated: 2026-04-03

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
  - live count: `52`
  - current reading: mostly source-display residue rather than true timing drift
- structured -> json:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `7`
  - current reading: active runtime follow-up lane
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

Current likely families in the `7`-spell runtime residue set:

- reaction trigger wording living in structured text while runtime JSON keeps only
  normalized base timing
- longer-casting display wording differences
- possible true implementation drift on a smaller residue subset

Representative runtime sample spells from the report:

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

- canonical -> structured: source-shape residue
- structured -> json: usually model/display boundary, not real runtime drift

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

Status: implemented in the gate checker and sufficiently classified.

What the gate checker now shows:

- problem statement
- classification
- review verdict
- structured value
- canonical value
- base timing fact
- ritual and ritual-expanded timing when relevant

Remaining work:

- none required for basic visibility
- only policy review if the project later wants canonical display strings to
  round-trip more literally

### Phase 2: Structured -> JSON

Status: implemented in the gate checker as a separate subsection.

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

- review the `7` live runtime mismatches one by one
- split them into:
  - accepted model/display boundary
  - real implementation drift

## Progress Log

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

- audit the `7` structured -> json mismatches directly
- record which of those are:
  - real implementation drift
  - accepted model/display boundary
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

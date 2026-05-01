# Spell Duration Bucket Tracker

Last Updated: 2026-04-28

## Bucket Purpose

This tracker exists for the `Duration` spell-truth bucket.

The bucket is responsible for two separate comparisons:

1. `canonical -> structured`
2. `structured -> json`

This matters because the glossary spell card renders from runtime spell JSON, not
from the structured markdown block. A spell is not fully covered just because the
canonical snapshot and structured duration line were compared successfully.

## Current Status

- canonical -> structured:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `17`
  - current reading: mostly source-display residue plus a small model-gap core
- structured -> json:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live count: `15`
  - current reading: mixed runtime follow-up lane after closing the two-spell true drift pilot
- glossary gate checker:
  - canonical -> structured `Duration Review`: implemented
  - structured -> json `Structured -> JSON` subsection inside `Duration Review`: implemented

## Current Interpretation

### Canonical -> Structured

This side is mostly about copied source display strings such as:

- `Concentration 1 Minute`
- `Until Dispelled`
- `Until Dispelled or Triggered`

The structured spell layer often splits those ideas apart into:

- concentration flag
- duration type
- duration value and unit

So the canonical-side bucket is mostly:

- source-shape residue
- accepted normalization
- model gap on a smaller residue set

not broad evidence of wrong spell duration facts.

### Structured -> JSON

This side answers the runtime question:

- does the structured duration layer still differ from the live spell JSON that
  the glossary actually renders?

Current likely families in the `15`-spell runtime residue set:

- flattened concentration wording
- plain duration wording / pluralization residue
- normalized `special` duration boundaries
- trigger-ended persistence boundary
- alternate-source duration shape
- resolved true-runtime-drift cases (`pyrotechnics`, `transport-via-plants`, `chill-touch`)

Current runtime spell set:

- `conjure-celestial`
- `conjure-elemental`
- `contagion`
- `dream-of-the-blue-veil`
- `hallow`
- `hold-monster`
- `infernal-calling`
- `leomunds-secret-chest`
- `maelstrom`
- `mirage-arcane`
- `mordenkainens-magnificent-mansion`
- `sequester`
- `simulacrum`
- `symbol`
- `transmute-rock`

## Key Mismatch Families

### 1. Flattened Concentration Display

Examples:

- `hold-monster`
- `infernal-calling`
- `maelstrom`
- `conjure-elemental`
- `conjure-celestial`

Canonical snapshots flatten concentration and timed duration into one string such as
`Concentration 1 Minute`, while the structured model keeps them as separate facts.

Current reading:

- canonical -> structured: source-display residue
- structured -> json: usually low-severity wording residue if the runtime JSON is
  already carrying the same timed duration and concentration flag

### 2. Duration Unit Pluralization

Examples:

- `contagion`
- `dream-of-the-blue-veil`
- `mirage-arcane`
- `mordenkainens-magnificent-mansion`
- `sequester`
- `simulacrum`

The structured or runtime duration display still says things like `1 Minutes`,
`7 Dayss`, or case-shifted `Until dispelled`.

Current reading:

- canonical -> structured: source-display or formatting residue
- structured -> json: low-severity display residue unless the runtime JSON is
  actually storing the wrong unit or value

### 3. Special-Bucket Normalization

Examples:

- `hallow`
- `leomunds-secret-chest`
- `transmute-rock`

The canonical or structured layer is more explicit than the runtime JSON, while the
runtime JSON still stores a generic `special` duration bucket.

Current reading:

- canonical -> structured: model/display boundary
- structured -> json: model gap / accepted normalization unless the project decides
  the runtime model should grow an explicit `until_dispelled` shape

### 4. Trigger-Ended Persistence Boundary

Examples:

- `symbol`
- canonical-side anchor: `glyph-of-warding`

The source carries an extra trigger-ending clause that the current duration model
does not represent explicitly.

Current reading:

- canonical -> structured: model gap
- structured -> json: model gap if the runtime spell JSON still only has a generic
  `special` duration bucket

### 5. Alternate-Source Shape

Examples:

- `arcane-sword`

`arcane-sword` is intentionally kept as an alternate-source duration shape because
the approved spell source is Roll20 rather than the D&D Beyond capture pattern used
for most canonical spell records.

Current reading:

- canonical -> structured: source-shape residue / accepted policy boundary
- structured -> json: not part of the current runtime `15` mismatch set unless a
  future comparable canonical field is authored

### 6. Likely True Runtime Drift

Examples:

- `chill-touch`
- `pyrotechnics`
- `transport-via-plants`

These cases were direct-review pilots for real runtime duration drift. All were
confirmed as JSON drift and corrected:

- `chill-touch`: runtime top-level duration changed from `timed 1 round` to `instantaneous`
- `pyrotechnics`: runtime duration changed from `timed 1 minute` to `instantaneous`
- `transport-via-plants`: runtime duration unit changed from `round` to `minute`

Current reading:

- canonical -> structured: not the main question
- structured -> json: resolved implementation drift

## Per-Phase Plan

### Phase 1: Canonical -> Structured

Status: implemented in the gate checker and sufficiently classified.

What the gate checker now shows:

- what is wrong
- severity
- semantic status
- classification
- recommended action
- structured value
- canonical value
- canonical breakdown
- current JSON duration facts for context

Remaining work:

- no basic visibility gap remains
- only policy/model review for:
  - `Until Dispelled`
  - `Until Dispelled or Triggered`
  - alternate-source duration shape

### Phase 2: Structured -> JSON

Status: implemented in the gate checker as a separate runtime subsection.

What the gate checker now shows:

- what is wrong
- severity
- classification
- review verdict
- explanation
- structured value
- current JSON value
- parsed structured facts
- parsed runtime facts
- whether the structured value still matches runtime JSON

Remaining work:

- review the remaining `15` runtime mismatches directly
- split them into:
  - flattened concentration wording
  - plain duration wording residue
  - accepted special-bucket normalization
  - trigger-ended persistence boundary
  - real runtime drift, if any new cases appear after the pilot fix

## Progress Log

### 2026-04-04

- confirmed there was no existing duration-specific living tracker doc
- created this tracker under `docs\tasks\spells\duration`
- confirmed the canonical-side live count is `17`
- confirmed the runtime-side live count is also `17`
- confirmed the gate checker originally had a strong canonical `Duration Review`
  block, but no separate runtime duration lane
- added a dedicated `Structured -> JSON` subsection inside `Duration Review`
- strengthened the duration wording so the bucket now says what is wrong, how
  severe it is, whether it is semantically equivalent, and what should happen next
- updated the shared spell-truth docs to reflect the bucket’s current two-phase state

- split the runtime duration lane into explicit subbuckets so the gate checker can
  distinguish flattened concentration wording from plain wording residue and from
  special-duration model boundaries

### 2026-04-28

- closed the `likely_true_runtime_drift` pilot subbucket
- corrected `pyrotechnics` runtime JSON from `timed 1 minute` to `instantaneous`
- corrected `transport-via-plants` runtime JSON from `timed 1 round` to `timed 1 minute`
- corrected `chill-touch` runtime JSON from `timed 1 round` to `instantaneous`
- reduced the structured -> json Duration live count from `17` to `15`
- promoted `duration_wording_runtime_residue` as the next active runtime review lane

## Remaining Work

- audit the remaining `15` structured -> json mismatches directly
- classify each remaining runtime case as:
  - flattened concentration wording
  - plain duration wording residue
  - accepted special-bucket normalization
  - trigger-ended persistence boundary
  - real implementation drift if any cases remain after classification
- decide whether the runtime duration model should expand beyond the current
  `special` bucket for `until dispelled` style spells

## Open Questions / Model Gaps

1. Should the canonical snapshot format eventually split `Concentration` out of
   the copied `Duration` line so the canonical side stops flattening two facts
   into one display string?

2. Should the runtime spell JSON gain an explicit duration concept for:
   - `until_dispelled`
   - `until_dispelled_or_triggered`
   instead of keeping those under the generic `special` bucket?

3. Should the runtime duration lane distinguish more explicitly between:
   - wording-only residue
   - structured-vs-json semantic equality
   - true runtime gameplay drift
   in the shared report as well as the selected-spell gate checker?

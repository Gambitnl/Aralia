# Spell Higher Levels Bucket Tracker

Last Updated: 2026-04-29

This tracker is the living handoff surface for the `Higher Levels` bucket in the
spell-truth lane.

It exists because `Higher Levels` is not one simple mismatch family. It now spans:

- `canonical -> structured`
- `structured -> json`
- optional runtime scaling-model follow-up through `higherLevelScaling`

The glossary spell card renders from runtime spell JSON, so this bucket is only
fully reviewed when both comparison phases are visible.

## Bucket Purpose

The bucket answers three different questions:

1. does the structured spell markdown still preserve the spell's higher-level
   behavior from the canonical source?
2. does the runtime spell JSON still preserve the same higher-level behavior as
   the structured spell markdown?
3. is a spell only storing readable prose in `higherLevels`, or does it need
   additional structured runtime scaling data in `higherLevelScaling`?

## Current Status

- canonical -> structured:
  - `24` mismatches in `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: mostly source-shape residue
  - dominant kinds:
    - `prefix_only_residue`: `13`
    - `canonical_inline_only`: `6`
    - `statblock_tail_residue`: `2`
    - `true_canonical_drift`: `3`
- structured -> json:
  - `0` mismatches in `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: runtime lane closed
  - dominant kind: none live
- duplicate prose follow-up:
  - `0` live spells where `Description` already repeats the same higher-level prose
  - current reading: closed by moving the upcast text into the dedicated `Higher Levels` / `higherLevels` surface only
- glossary gate checker:
  - canonical -> structured `Higher Levels Review`: implemented
  - structured -> json `Higher Levels Runtime Review`: implemented

## Current Interpretation

### Canonical -> Structured

This side is mostly not proving real drift.

The main issue is that the canonical snapshot usually keeps higher-level text
inside raw `Rules Text` instead of exposing a separate comparable `Higher Levels`
field.

That makes most of the live canonical-side count:

- source-shape residue

not:

- broad unsynced structured data

### Structured -> JSON

This is the meaningful runtime lane because the glossary renders JSON.

Current live spells in the runtime mismatch set:

- none

Closed runtime families:

- missing structured field while JSON already had the value:
  - `bigbys-hand`
  - `bones-of-the-earth`
  - `crown-of-stars`
  - `elemental-bane`
  - `enervation`
- formatting-only runtime residue:
  - `mass-suggestion`
  - `wall-of-thorns`
- duplicate description prose:
  - `banishment`
  - `blight`
  - `elemental-bane`
  - `enervation`
- cantrip runtime drift discovered during the pass:
  - `chill-touch`
  - `shocking-grasp`
- formatting-only candidate:
  - `create-undead`

## Active Subbucket Split

The gate checker now needs to speak in these subbuckets, not just broad
classifications:

- `canonical_inline_only`
  - canonical-side source-shape residue
- `prefix_only_residue`
  - one side keeps a heading like `Using a Higher-Level Spell Slot.`
- `statblock_tail_residue`
  - canonical keeps extra summon/stat-block tail text in the same prose block
- `structured_missing_json_present`
  - structured field is blank while runtime JSON already has the value
- `runtime_missing_structured_present`
  - structured field exists but runtime JSON is missing it
- `description_duplicate_residue`
  - `Description` already includes the same higher-level prose as the dedicated field
- `punctuation_or_formatting_residue`
  - punctuation, spacing, or quote-level difference without semantic drift
- `true_canonical_drift`
  - canonical -> structured real disagreement
- `true_runtime_drift`
  - structured -> json real disagreement

## Key Mismatch Families

### 1. Canonical inline prose / source-shape residue

- type: source-shape residue
- meaning: canonical source keeps higher-level text inline under `Rules Text`
- effect on audit: the report marks a missing canonical Higher Levels field even
  when the spell is already represented correctly elsewhere
- current examples:
  - `storm-sphere`
  - `dawn`
  - `infernal-calling`
  - `mass-cure-wounds`
  - `planar-binding`
  - `wall-of-light`

### 1b. Canonical prefix-only residue

- type: source-shape residue
- meaning: canonical source prepends a heading like `Using a Higher-Level Spell Slot.`
  or `At Higher Levels.` while the structured field already carries the same
  core sentence
- current examples:
  - `charm-monster`
  - `dominate-beast`
  - `freedom-of-movement`
  - `hold-monster`
  - `conjure-celestial`

### 1c. Canonical statblock-tail residue

- type: source-shape residue
- meaning: canonical source appends summon/stat-block detail after the opening
  upcast sentence, while the structured field intentionally stores only the
  concise higher-level rule
- current examples:
  - `giant-insect`
  - `animate-objects`

### 1d. Real canonical wording drift

- type: real drift
- meaning: the canonical upcast text is not explained by prefix residue or a
  stat-block tail
- current examples:
  - `cone-of-cold`
  - `conjure-elemental`
  - `flame-strike`

### 2. Structured header missing while JSON has data

- type: closed structured-layer drift
- meaning: runtime JSON already has `higherLevels`, but the structured `.md`
  field is blank
- current examples:
  - none live
- closed examples:
  - `bigbys-hand`
  - `bones-of-the-earth`
  - `crown-of-stars`
  - `elemental-bane`
  - `enervation`

### 3. Prefix-only runtime residue

- type: closed normalized difference
- meaning: one layer stores the standard source heading `Using a Higher-Level Spell Slot.`
  while the other stores only the core scaling sentence
- current examples:
  - none live
- closed examples:
  - `mass-suggestion`
  - `wall-of-thorns`

### 3b. Duplicate runtime higher-level prose

- type: closed redundancy residue
- meaning: the same higher-level prose exists both in `Description` and in the
  dedicated `higherLevels` field
- current examples:
  - none live
- closed examples:
  - `banishment`
  - `blight`
  - `elemental-bane`
  - `enervation`

### 3c. Cantrip runtime higher-level drift

- type: closed real drift
- meaning: newly structured cantrip markdown exposed runtime `higherLevels`
  text that lagged behind the canonical cantrip upgrade wording
- closed examples:
  - `chill-touch`
  - `shocking-grasp`

### 4. Scaling model gap

- type: model gap
- meaning: prose can describe the upcast rule, but the runtime model may still
  need richer structured scaling under `higherLevelScaling`
- especially relevant when a spell scales:
  - multiple independent values
  - tables by slot level
  - target-count changes
  - summon/stat-block payloads

## Per-Phase Plan

### Phase 1: Canonical -> Structured

- keep the current bucket documented as source-shape residue
- do not treat the `24` count as if it were broad content failure
- use the raw canonical snapshot only as evidence, not as proof that the
  structured field is wrong

### Phase 2: Structured -> JSON

- status: closed
- the `8` original runtime mismatches were reviewed directly
- duplicate-prose cases were reviewed separately and removed from `Description`
- newly surfaced cantrip drift was fixed in runtime JSON
- the runtime review remains separate from canonical review in the glossary gate
  checker

### Phase 3: Scaling-model follow-up

- for spells whose prose cannot cleanly power runtime behavior alone, decide
  whether `higherLevelScaling` needs to be populated
- do not force every spell into structured scaling immediately
- keep `higherLevels` as the readable rule surface even when
  `higherLevelScaling` is added

## Progress Log

- 2026-03-31
  - `SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md` established that most
    canonical upcast text was already represented elsewhere in the spell file
- 2026-04-03
  - current live reports refreshed:
    - `126` canonical -> structured mismatches
    - `8` structured -> json mismatches
- 2026-04-03
  - spell gate checker gained canonical `Higher Levels Review`
- 2026-04-04
  - spell gate checker gained separate `Higher Levels Runtime Review`
  - this closed the architecture gap where Higher Levels only explained
    `canonical -> structured`
- 2026-04-06
  - Higher Levels docs and gate checker were updated to use explicit subbucket
    language instead of only broad bucket classifications
- 2026-04-27
  - Atlas v2 pass updated the bucket map to the live split:
    - canonical -> structured: `24`
    - structured -> json: `8`
    - duplicate prose follow-up: `4`
  - the duplicate runtime lane is now explicitly tracked in the gate checker as
    `description_duplicate_residue`
- 2026-04-28
  - Atlas v3 pass re-verified the Higher Levels map against the live tracker
    and the resolved Atlas gaps
  - the map's sample canonical rosters were corrected so:
    - `prefix_only_residue` matches the tracker examples
    - `true_canonical_drift` now points at `conjure-elemental`, not `conjure-celestial`
  - no new Atlas-model gaps were needed for this bucket
- 2026-04-29
  - active `description_duplicate_residue` subbucket closed:
    - `banishment`
    - `blight`
    - `elemental-bane`
    - `enervation`
  - structured -> json `Higher Levels` closed to `0` live mismatches
  - additional runtime fixes landed for:
    - `bigbys-hand`
    - `bones-of-the-earth`
    - `create-undead`
    - `crown-of-stars`
    - `mass-suggestion`
    - `wall-of-thorns`
    - `chill-touch`
    - `shocking-grasp`
  - Atlas Phase 2 histories were appended with zero-count snapshots

## Remaining Work

- follow-up decision on when `higherLevelScaling` is required instead of only
  optional

## Open Questions / Model Gaps

- when should a spell with correct `higherLevels` prose also be required to carry
  `higherLevelScaling`?
- when `Description` already contains the exact higher-level text, should the
  normalized model prefer:
  - keeping both for readability + runtime clarity
  - trimming the prose out of `Description`
  - or collapsing the dedicated field back into prose?
- should prefix-only differences be normalized away in the structured/runtime
  audit, or kept visible as low-severity residue?
- should the canonical audit eventually extract higher-level text directly from
  `Rules Text` so the canonical-side `24` count stops over-reporting source-shape
  residue?

## Current Bottom Line

The bucket is no longer missing gate-checker coverage.

Current status is:

- canonical side: mostly source-shape residue
- runtime side: closed
- remaining work is policy/model review around `higherLevelScaling`, plus any
  later decision to improve canonical `Rules Text` extraction

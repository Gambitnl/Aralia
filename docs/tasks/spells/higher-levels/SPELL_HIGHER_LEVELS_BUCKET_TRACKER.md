# Spell Higher Levels Bucket Tracker

Last Updated: 2026-04-06

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
  - `126` mismatches in `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: mostly source-shape residue
  - dominant kind: `missing-canonical-field`
- structured -> json:
  - `8` mismatches in `SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: small active runtime follow-up lane
  - dominant kind: `missing-structured-field`
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

- `bigbys-hand`
- `bones-of-the-earth`
- `create-undead`
- `crown-of-stars`
- `elemental-bane`
- `enervation`
- `mass-suggestion`
- `wall-of-thorns`

Current runtime reading by family:

- missing structured field while JSON already has the value:
  - `bigbys-hand`
  - `bones-of-the-earth`
  - `crown-of-stars`
  - `elemental-bane`
  - `enervation`
  - this is structured-layer lag, not runtime lag
- formatting-only runtime residue:
  - `mass-suggestion`
  - `wall-of-thorns`
  - current difference is the `Using a Higher-Level Spell Slot.` prefix
- possible narrower real text drift still worth review:
  - `create-undead`
  - current difference is punctuation/spacing only in the live report, so this
    may downgrade to formatting residue after direct review

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
- `punctuation_or_formatting_residue`
  - punctuation, spacing, or quote-level difference without semantic drift
- `true_canonical_drift`
  - canonical -> structured real disagreement
- `true_runtime_drift`
  - structured -> json real disagreement

## Key Mismatch Families

### 1. Canonical inline prose

- type: source-shape residue
- meaning: canonical source keeps higher-level text inline under `Rules Text`
- effect on audit: the report marks a missing canonical Higher Levels field even
  when the spell is already represented correctly elsewhere

### 2. Structured header missing while JSON has data

- type: real structured-layer drift
- meaning: runtime JSON already has `higherLevels`, but the structured `.md`
  field is blank
- current examples:
  - `bigbys-hand`
  - `bones-of-the-earth`
  - `crown-of-stars`
  - `elemental-bane`
  - `enervation`

### 3. Prefix-only runtime residue

- type: normalized difference
- meaning: one layer stores the standard source heading `Using a Higher-Level Spell Slot.`
  while the other stores only the core scaling sentence
- current examples:
  - `mass-suggestion`
  - `wall-of-thorns`

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
- do not treat the `126` count as if it were broad content failure
- use the raw canonical snapshot only as evidence, not as proof that the
  structured field is wrong

### Phase 2: Structured -> JSON

- review the `8` live runtime mismatches directly
- split each spell into:
  - structured missing
  - formatting-only residue
  - true runtime drift
- keep the runtime review separate from canonical review in the glossary gate
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

## Remaining Work

- direct review of the `8` runtime mismatch spells
- explicit judgment on whether `create-undead` is real runtime drift or only
  formatting residue
- follow-up decision on when `higherLevelScaling` is required instead of only
  optional

## Open Questions / Model Gaps

- when should a spell with correct `higherLevels` prose also be required to carry
  `higherLevelScaling`?
- should prefix-only differences be normalized away in the structured/runtime
  audit, or kept visible as low-severity residue?
- should the canonical audit eventually extract higher-level text directly from
  `Rules Text` so the canonical-side `126` count stops over-reporting source-shape
  residue?

## Current Bottom Line

The bucket is no longer missing gate-checker coverage.

Current status is:

- canonical side: mostly source-shape residue
- runtime side: small active audit lane
- implementation work still remains, but it is focused and no longer
  architecture-blocked

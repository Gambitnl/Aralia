# Spell Components Bucket Tracker

Last Updated: 2026-04-04

## Bucket Purpose

This tracker exists for the `Components` spell-truth bucket.

The bucket has to cover two separate comparison phases:

- canonical -> structured
- structured -> json

That split matters because the glossary spell card renders from runtime spell JSON,
not from the structured markdown block. A spell is not fully covered just because
the structured `Components` line was compared against the copied canonical snapshot.

## Current Status

- canonical -> structured:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - live count: `3`
  - grouped kind: `value-mismatch`
  - practical reading: small source-shape residue bucket, not broad factual drift
- structured -> json:
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - live grouped bucket: none
  - practical reading: no separate corpus-wide grouped runtime bucket is currently being reported
- glossary gate checker:
  - canonical -> structured `Components Review`: implemented
  - structured -> json `Components Runtime Review`: implemented

## Bucket Interpretation

### Canonical -> Structured

This side is currently a small source-display bucket.

The remaining spells are:

- `feather-fall`
- `soul-cage`
- `arcane-sword`

Current dominant categories:

- source-shape residue
- accepted normalization

Current live subbuckets:

- `footnote_marker_residue`
- `alternate_source_shape`
- `true_components_drift`

Typical patterns:

- canonical footnote marker changes such as `*` vs `**`
- alternate-source raw component string shape
- compact raw source line versus normalized Aralia header

This lane should not currently be read as "the spell forgot its V/S/M facts."

### Structured -> JSON

This side asks the runtime question:

- does the structured `Components` line still match the live spell JSON that the
  glossary actually renders?

Current reading:

- gate-checker support now exists
- the corpus-wide shared report does not currently expose `Components` as a separate
  grouped runtime bucket
- this means the bucket is not broad active runtime residue right now, but it still
  needs selected-spell review support so the app layer can be checked directly when
  a component discrepancy is suspected

Current dominant categories:

- model/display boundary
- possible narrow real runtime drift on individual spells

Current live/runtime review subbuckets:

- `aligned`
- `model_display_boundary`
- `missing_runtime_components`
- `missing_structured_components`
- `real_runtime_drift`

## Key Mismatch Families

### Canonical -> Structured

#### 1. Footnote-marker residue

Examples:

- `feather-fall`
- `soul-cage`

Meaning:

- the visible V/S/M letters still match
- the raw canonical component line uses a different marker like `**`
- the structured header keeps the normalized Aralia footnote shape

Current reading:

- source-shape residue

#### 2. Alternate-source raw component string shape

Example:

- `arcane-sword`

Meaning:

- the approved alternate source keeps material text inline in the component string
- the structured Aralia layer stores a normalized compact `V/S/M` header instead

Current reading:

- source-shape residue
- alternate-source boundary

### Structured -> JSON

#### 1. Same component facts, different storage shape

Meaning:

- the structured layer stores one compact component header
- runtime JSON stores:
  - verbal
  - somatic
  - material
  - materialDescription
  - materialCost
  - consumed

Current reading:

- model/display boundary

#### 2. Real runtime drift

Meaning:

- the structured V/S/M letters and the runtime JSON component booleans do not agree
- or the structured layer implies material presence while the runtime JSON does not

Current reading:

- implementation drift
- currently not proven to be a broad corpus bucket

#### 3. Missing runtime components

Meaning:

- the structured layer has a comparable V/S/M line
- but the runtime spell JSON is missing the component facts needed to render the
  same requirement in the glossary

Current reading:

- real implementation drift
- high-severity if it appears

#### 4. Missing structured components

Meaning:

- the runtime JSON may have component facts
- but the interpreted structured layer does not expose a comparable `Components`
  line, so the runtime comparison is blocked

Current reading:

- structured-layer blocker
- not proof that runtime JSON is wrong by itself

## Per-Phase Plan

### Phase 1: Canonical -> Structured

Goal:

- keep the tiny `3`-spell bucket documented as source-shape residue instead of
  letting it be mistaken for broad missing component truth

Actions:

- keep `Components Review` visible in the glossary gate checker
- preserve the footnote-marker and alternate-source classifications
- preserve the explicit subbucket names so future review can separate source-shape
  residue from true component drift without re-deriving the taxonomy
- keep the shared docs explicit that this lane is mostly normalized difference

### Phase 2: Structured -> JSON

Goal:

- keep runtime component review separate from canonical review

Actions:

- keep the dedicated `Components Runtime Review` block in the gate checker
- show:
  - structured value
  - current JSON value
  - structured V/S/M letters
  - current JSON V/S/M letters
  - whether the runtime JSON is truly behind or only differently shaped
- keep the runtime subbucket names visible:
  - `aligned`
  - `model_display_boundary`
  - `missing_runtime_components`
  - `missing_structured_components`
  - `real_runtime_drift`

### Phase 3: Runtime-report follow-up

Goal:

- decide whether `Components` needs to become a first-class grouped bucket in the
  shared structured-vs-json report

Actions:

- verify whether any live spell currently produces true runtime component drift
- if yes, make sure the shared runtime report surfaces it as its own grouped bucket
- if not, keep the runtime lane as a selected-spell diagnostic rather than inflating
  it into a fake backlog

## Progress Log

### 2026-04-04

- confirmed the canonical-side live count is `3`
- confirmed the canonical-side remaining spells are:
  - `feather-fall`
  - `soul-cage`
  - `arcane-sword`
- confirmed the shared structured-vs-json report does not currently list
  `Components` as a grouped runtime bucket
- confirmed the earlier gate checker only covered canonical -> structured for this bucket
- added a separate `Components Runtime Review` block to the glossary spell gate checker
- updated the gate hook so the bucket now exposes:
  - `problemStatement`
  - `classification`
  - `reviewVerdict`
  - `explanation`
  - structured V/S/M letters
  - current JSON V/S/M letters
  - exact-match vs semantic-boundary state
- recorded the working subbucket taxonomy explicitly in this tracker so future
  agents do not have to infer it from the gate-checker code

### 2026-04-06

- updated the shared spell-truth docs so the Components subbucket vocabulary is
  visible in the plan, sync tracker, and flags ledger
- updated the live spell gate checker to surface `Subbucket` explicitly in both:
  - `Components Review`
  - `Components Runtime Review`
- this means future selected-spell review no longer has to treat the generic
  `Classification` line as the only visible proxy for the bucket taxonomy
- updated shared spell-truth docs to reflect that runtime support now exists even
  though the shared runtime report does not currently show a grouped `Components` bucket

## Remaining Work

- verify on live selected spells whether any real structured -> json component drift
  still exists beyond model/display boundary
- decide whether the shared structured-vs-json report should grow a dedicated
  `Components` bucket or whether selected-spell runtime review is sufficient
- keep `Material Component` and `Components` separate so raw material-note drift does
  not get folded into the V/S/M bucket

## Open Questions / Model Gaps

1. Should runtime spell JSON ever be expected to round-trip the exact structured
   component header string, or is semantic agreement on the decomposed facts enough?

2. Should the shared structured-vs-json report gain a dedicated `Components` bucket
   if the gate checker can already surface selected-spell runtime drift directly?

3. Should alternate-source shapes like `arcane-sword` remain in the same `Components`
   bucket, or eventually be split into a separate alternate-source residue class?

## Current Bucket Verdict

- canonical -> structured: mostly source-shape residue / accepted normalization
- structured -> json: implementation support now exists in the gate checker, but
  the shared report does not currently show a grouped runtime Components bucket
- policy review only: no
- implementation work still needed: maybe, but only if live selected-spell review
  proves real runtime drift
- audit work still needed: yes
- runtime gate-checker coverage: implemented

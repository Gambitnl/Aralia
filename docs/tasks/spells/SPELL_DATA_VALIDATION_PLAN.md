# Spell Data Validation Plan

Last Updated: 2026-04-09

This file captures the current plan for validating spell JSON structure and spell reference parity.

## Current Status Snapshot

- `npm run validate:spells` is currently green: `459 / 459` valid spell JSON files.
- Canonical retrieval is complete for the supported corpus. Every supported spell now has a canonical snapshot stored in its spell reference markdown file.
- The canonical-to-structured comparison lane is still active as a review lane, but the current report is now much smaller and more targeted than the earlier stale snapshot:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - generated `2026-04-09`
  - `418` mismatches across `9` grouped buckets
- The structured-to-runtime comparison lane is the main active implementation-follow-up surface:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - generated `2026-04-09`
  - `177` mismatches across `7` grouped buckets
- The canonical-rules audit currently reports a separate high-noise retrieval-shape problem:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_RULES_AUDIT_REPORT.md`
  - generated `2026-04-09`
  - `455` findings
  - practical reading: this is currently a canonical snapshot storage/formatting issue, not a live spell JSON validation failure
- The glossary-facing spell gate artifact has also been regenerated:
  - `F:\Repos\Aralia\public\data\spell_gate_report.json`
  - generated `2026-04-09`
- The spell model now has a dedicated optional structured home for higher-level scaling data:
  - `F:\Repos\Aralia\src\types\spells.ts`
  - `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
  - `F:\Repos\Aralia\src\systems\spells\mechanics\ScalingEngine.ts`
  - `F:\Repos\Aralia\scripts\add_spell.js`
- That `higherLevelScaling` field is intentionally optional for now so the live corpus can stay valid while scaling is normalized incrementally.

The corpus-wide execution tracker that lists every spell in scope now lives at:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CORPUS_EXECUTION_TRACKER.md`

That tracker should now be read as the historical corpus inventory and broad execution checklist.
It is no longer the most up-to-date completion surface because the spell-truth lane has since split into:
- canonical capture completion
- structured-vs-canonical review
- structured-vs-json runtime review
- accepted residue / model-gap review

The live current-state surfaces are now:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`

The tracker now also contains the corpus-completion plan and the current per-spell
done definition, so the project has one place that answers:
- what "done" means for one spell
- what order the full corpus should be worked in
- when a spell should remain unchecked and move into arbitration instead

The goal is not just to prove that the spell system exists. The goal is to prove that the spell data is shaped consistently, validated against the live schema, and documented faithfully enough that roadmap completion can later mean "validated" rather than only "implemented."

## Current Active Review Shape

Right now the live spell-truth lane is best read as four parallel surfaces:

1. `canonical -> structured`
   - tracked by `SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
   - current live residue:
     - `Range/Area` `172`
     - `Sub-Classes` `71`
     - `Casting Time` `52`
     - `Description` `51`
     - `Higher Levels` `24`
     - `Classes` `17`
     - `Duration` `17`
     - `Material Component` `11`
     - `Components` `3`

2. `structured -> json`
   - tracked by `SPELL_STRUCTURED_VS_JSON_REPORT.md`
   - current live residue:
     - `Range/Area` `61`
     - `Sub-Classes` `45`
     - `Description` `34`
     - `Duration` `17`
     - `Higher Levels` `8`
     - `Casting Time` `7`
     - `Material Component` `5`

3. `description taxonomy`
   - tracked by `SPELL_DESCRIPTION_SUBBUCKET_REPORT.md`
   - current live description split:
     - `area-and-targeting-wording-shift` `23`
     - `general-phrasing-rewrite` `11`
     - `condition-and-save-wording-shift` `10`
     - `uncategorized` `3`
     - `canonical-2024-terminology-shift` `2`
     - `damage-and-scaling-wording-shift` `2`

4. `higher-level description coverage`
   - tracked by `SPELL_HIGHER_LEVEL_DESCRIPTION_COVERAGE_REPORT.md`
   - current live result:
     - `7` analyzed
     - all `7` currently fall under `represented-elsewhere`

## Template Ownership Surfaces

The spell-truth lane is not only a report/review lane. It also depends on the
live template surfaces that define what spell data can look like and what new
spell files start from.

Those files are:
- `F:\Repos\Aralia\src\types\spells.ts`
  - shared runtime spell template
  - first place to look when a bucket exposes a missing concept or weak data shape
- `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`
  - machine gate for what the spell JSON may actually contain
  - first place to look when the model exists in principle but the JSON is being rejected
- `F:\Repos\Aralia\scripts\add_spell.js`
  - new spell scaffold
  - must stay aligned so the repo stops generating outdated spell shapes
- `F:\Repos\Aralia\src\systems\spells\mechanics\ScalingEngine.ts`
  - relevant when a bucket affects higher-level scaling or runtime interpretation

When a bucket review concludes that the current spell model is too weak, these
files are the implementation surfaces that should be updated, not just the spell
reports.

## Active Bucket: Description

The `Description` bucket is now a two-phase bucket rather than a single canonical-review
problem.

- phase 1: `canonical -> structured`
- phase 2: `structured -> json`

Current live status:

- canonical -> structured:
  - `51` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: real canonical-to-structured prose drift after the canonical-side
    parser fix on `2026-04-04`
- structured -> json:
  - `34` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: active runtime implementation-follow-up lane with a mix of:
    - real implementation drift
    - formatting / encoding residue

Current bucket reading:

- canonical -> structured is now the primary Description lane and a real copying lane
- structured -> json is the meaningful active lane, because the glossary renders from
  runtime spell JSON rather than the structured markdown block, but it should be
  handled as follow-through after canonical -> structured is squared away

Current gate-checker coverage:

- canonical -> structured `Description Review`: implemented
- structured -> json `Description Runtime Review`: implemented

Current subbucket split:

- canonical -> structured:
  - `real-prose-drift`: `30`
  - `canonical-extra-rules-detail`: `13`
  - `higher-level-text-still-inline-or-missing`: `8`
- structured -> json:
  - `wording-shift-still-needs-review`: `18`
  - `real-runtime-drift`: `16`

What still needs to happen next:

- work the canonical -> structured Description subbuckets first in this order:
  1. `real-prose-drift`
  2. `canonical-extra-rules-detail`
  3. `higher-level-text-still-inline-or-missing`
- copy the remaining canonical Description mismatches into structured markdown
  file-by-file
- then copy the corrected structured Description values into runtime JSON where the
  runtime layer still lags behind
- split the runtime `34`-spell residue into:
  - real runtime drift
  - formatting / encoding residue
  - blocked comparison cases when structured Description is missing
- decide later whether runtime `description` is expected to match structured
  `Description` literally where possible, or only semantically

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\description\SPELL_DESCRIPTION_BUCKET_TRACKER.md`

## Casting Time Bucket

The `Casting Time` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `52` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: mostly source-display residue
  - common cases:
    - ritual inline display such as `1 Minute Ritual`
    - trigger footnote display such as `1 Reaction *`
- structured -> json:
  - `7` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: small active runtime follow-up lane
  - representative spells:
    - `counterspell`
    - `dream-of-the-blue-veil`
    - `feather-fall`
    - `hellish-rebuke`
    - `legend-lore`
    - `mirage-arcane`
    - `shield`

Current bucket reading:

- canonical -> structured is mostly accepted normalization / source-shape residue
- structured -> json is the meaningful runtime lane and still needs spell-by-spell
  review to separate:
  - real implementation drift
  - model/display boundary

Current gate-checker coverage:

- canonical -> structured `Casting Time Review`: implemented
- structured -> json `Structured -> JSON` subsection inside `Casting Time Review`:
  implemented

What still needs to happen next:

- review the `7` runtime mismatches directly
- mark which are:
  - real implementation drift
  - accepted model/display boundary
- leave the canonical-side `52` documented as source-display residue unless a spell
  proves to have a true base timing disagreement

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\casting-time\SPELL_CASTING_TIME_BUCKET_TRACKER.md`

## Sub-Classes Bucket

The `Sub-Classes` bucket is a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

What the bucket means:

- canonical -> structured asks whether the normalized `Sub-Classes` field in the
  structured spell markdown still reflects the subclass/domain access preserved in
  the copied canonical snapshot
- structured -> json asks whether the glossary-facing runtime spell JSON still
  carries the same normalized subclass/domain access as the structured spell block

Current live status:

- canonical -> structured:
  - `156` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - grouped kind: `missing-canonical-field`
  - current reading: this is now the primary execution surface for the bucket, but
    it is still a mixed lane rather than a clean count of structured drift because
    many canonical snapshots preserve subclass/domain access inside raw
    `Available For` capture without the current audit deriving a directly comparable
    normalized `Sub-Classes` field
- structured -> json:
  - `45` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - grouped kind: mainly `missing-json-field`
  - current reading: active runtime follow-through lane that should be worked after
    canonical-side transfer decisions are made spell-by-spell

Current bucket reading:

- canonical -> structured is the priority lane and currently mixes:
  - real structured omission
  - accepted normalization on repeated-base access lines
  - legacy / unsupported canonical evidence
  - source-shape residue
- structured -> json is mostly:
  - real implementation drift
  - verification lag
  - smaller normalization/boundary cases such as repeated-base subclass entries

Current gate-checker coverage:

- canonical -> structured `Sub-Classes Review`: implemented
- structured -> json `Sub-Classes Runtime Review`: implemented

What still needs to happen next:

- work the canonical-side bucket first using these subbuckets:
  - `missing_structured_subclasses`
  - `incomplete_structured_subclasses`
  - `repeated_base_canonical_entries`
  - `legacy_or_unsupported_canonical_entries`
  - `canonical_label_variant_residue`
  - `malformed_structured_subclass_field`
  - `canonical_source_shape_gap`
- use this working order:
  1. `missing_structured_subclasses`
  2. `incomplete_structured_subclasses`
  3. `malformed_structured_subclass_field`
  4. `legacy_or_unsupported_canonical_entries`
  5. `repeated_base_canonical_entries`
  6. `canonical_label_variant_residue`
  7. `canonical_source_shape_gap`
- only after the structured layer is squared away, work the `45` runtime mismatch
  spells directly and split them into:
  - real runtime drift
  - verification lag
  - repeated-base normalization
  - malformed structured-value cases
- keep repeated-base subclass/domain policy and verification semantics visible as
  open model questions while the canonical-side transfer work is in progress

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
Gemini handoff:
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_GEMINI_HANDOVER.md`

## Classes Bucket

The `Classes` bucket is a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

What the bucket means:

- canonical -> structured asks whether the normalized `Classes` field in the
  structured spell markdown still reflects the spell's base-class access as
  preserved in the copied canonical snapshot
- structured -> json asks whether the glossary-facing runtime spell JSON still
  carries the same normalized base-class list as the structured spell block

Current live status:

- canonical -> structured:
  - `17` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - grouped kind: `missing-canonical-field`
  - current reading: small active residue set, no longer a broad live class drift
    lane
- structured -> json:
  - no grouped `Classes` bucket currently appears in
    `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: no active corpus-scale runtime `Classes` backlog is exposed
    right now

Current bucket reading:

- canonical -> structured is mostly:
  - source-shape residue
  - accepted normalization around canonical `Available For` storage
  - with a small remaining named set that now splits into:
    - `12` missing-derived-classes cases
    - `5` metadata-leak parser cases where `Capture Method: http` polluted the
      comparable canonical value
- structured -> json is currently:
  - mostly resolved at grouped corpus scale
  - not showing runtime JSON lag for `Classes` as a shared backlog bucket
- the bucket can still surface real drift when it exists
  - representative historical example: `disguise-self`

Current gate-checker coverage:

- canonical -> structured `Classes Review`: implemented
- the `Classes Review` block already states whether the structured class line
  matches the live spell JSON, even though there is no grouped runtime
  `Classes` report bucket right now

What still needs to happen next:

- improve the canonical-side audit so it derives comparable base classes more
  directly from raw canonical `Available For`
- fix the canonical-side parser so non-class metadata cannot leak into the
  comparable canonical `Classes` value
- keep the live `17` canonical-side count documented as a small active residue set
  instead of letting the older stale `408` count continue to frame the bucket
- revisit runtime implementation work only if selected-spell review surfaces a
  real base-class mismatch

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\classes\SPELL_CLASSES_BUCKET_TRACKER.md`

## Higher Levels Bucket

The `Higher Levels` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `126` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current grouped kind: `missing-canonical-field`
  - practical reading: mostly source-shape residue, because canonical snapshots
    usually keep higher-level text inline under raw `Rules Text` instead of
    exposing a separate comparable `Higher Levels` field
- structured -> json:
  - `8` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current grouped kinds:
    - `missing-structured-field`
    - narrower `value-mismatch` residue
  - practical reading: small active implementation/audit lane

Current bucket reading:

- canonical -> structured is mostly:
  - source-shape residue
  - accepted normalization
- structured -> json is currently mixed:
  - structured-layer lag on a small named set
  - low-severity formatting residue
  - possible narrower real runtime drift
- this bucket also touches a model gap:
  - whether prose-only `higherLevels` is enough
  - or whether some spells should also require structured `higherLevelScaling`

Active subbucket direction:

- canonical side:
  - `canonical_inline_only`
  - `prefix_only_residue`
  - `statblock_tail_residue`
  - `true_canonical_drift`
- runtime side:
  - `structured_missing_json_present`
  - `runtime_missing_structured_present`
  - `prefix_only_residue`
  - `punctuation_or_formatting_residue`
  - `true_runtime_drift`

Current gate-checker coverage:

- canonical -> structured `Higher Levels Review`: implemented
- structured -> json `Higher Levels Runtime Review`: implemented
- both reviews now expose the subbucket directly in the glossary dev panel

What still needs to happen next:

- directly review the `8` runtime mismatch spells
- split them into:
  - structured missing
  - formatting-only residue
  - true runtime drift
- decide later when `higherLevelScaling` should be considered required rather
  than optional for runtime behavior
- keep the canonical-side `126` count documented as source-shape residue instead
  of treating it as if it were broad unresolved content drift

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\higher-levels\SPELL_HIGHER_LEVELS_BUCKET_TRACKER.md`

## Duration Bucket

The `Duration` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `17` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current reading: mostly source-display residue plus a smaller model-gap core
  - common cases:
    - flattened concentration display such as `Concentration 1 Minute`
    - `Until Dispelled`
    - `Until Dispelled or Triggered`
- structured -> json:
  - `17` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current reading: mixed runtime follow-up lane
  - representative spells:
    - `conjure-elemental`
    - `hold-monster`
    - `hallow`
    - `leomunds-secret-chest`
    - `pyrotechnics`
    - `symbol`
    - `transport-via-plants`

Current bucket reading:

- canonical -> structured is mostly:
  - accepted normalization
  - source-shape residue
  - model gap on the `Until Dispelled` / `Triggered` edge cases
- structured -> json is now the meaningful runtime lane and appears to mix:
  - flattened concentration wording residue
  - plain wording / pluralization residue
  - accepted special-bucket normalization
  - trigger-ended persistence boundary
  - narrower real implementation drift

Current gate-checker coverage:

- canonical -> structured `Duration Review`: implemented
- structured -> json `Structured -> JSON` subsection inside `Duration Review`:
  implemented
- selected-spell dev refresh now also flows runtime duration mismatch rows into the
  duration bucket instead of leaving duration as canonical-only review

What still needs to happen next:

- audit the `17` runtime mismatches directly
- split them into:
  - flattened concentration wording
  - plain wording / pluralization residue
  - accepted special-bucket normalization
  - trigger-ended persistence boundary
  - real runtime drift
- decide whether the runtime duration model should grow explicit support for:
  - `until_dispelled`
  - `until_dispelled_or_triggered`
- decide later whether the canonical snapshot format should split `Concentration`
  into its own copied field instead of keeping it flattened inside `Duration`

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\duration\SPELL_DURATION_BUCKET_TRACKER.md`

## Material Component Bucket

The `Material Component` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `11` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: small active copying/review lane
  - representative spells:
    - `stoneskin`
    - `raise-dead`
    - `reincarnate`
    - `summon-greater-demon`
    - `conjure-volley`
    - `swift-quiver`
- structured -> json:
  - `5` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current grouped kinds:
    - `value-mismatch`
    - `missing-json-field`
  - practical reading: small active runtime implementation lane
  - current named spells:
    - `magic-mouth`
    - `melfs-acid-arrow`
    - `true-seeing`
    - `vitriolic-sphere`
    - `wall-of-ice`

Current bucket reading:

- canonical -> structured is now the primary execution lane
- canonical -> structured currently splits into:
  - `canonical_consumed_state_drift`
  - `missing_structured_material_component`
  - `canonical_cost_drift`
  - `canonical_description_drift`
  - `canonical_wording_boundary`
  - `alternate_source_material_shape`
- structured -> json is the follow-through implementation lane because the glossary
  renders runtime spell JSON rather than the structured markdown block
- runtime review should happen after the matching spell is squared away in the
  structured layer, not as the first driver of the bucket

Current gate-checker coverage:

- canonical -> structured `Material Component Review`: implemented
- structured -> json `Material Component Runtime Review`: implemented

What still needs to happen next:

- work the canonical -> structured lane first in this order:
  1. `canonical_consumed_state_drift`
  2. `missing_structured_material_component`
  3. `canonical_cost_drift`
  4. `canonical_description_drift`
  5. `alternate_source_material_shape`
  6. `canonical_wording_boundary`
- after each structured fix, immediately check whether the matching runtime JSON
  is now behind and needs the same material-note correction carried forward
- then review the `5` runtime mismatch spells under these runtime subbuckets:
  - `missing_runtime_material_component`
  - `consumed_state_runtime_drift`
  - `cost_runtime_drift`
  - `description_runtime_drift`
  - `model_display_boundary`

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_BUCKET_TRACKER.md`
Gemini handoff:
- `F:\Repos\Aralia\docs\tasks\spells\material-component\SPELL_MATERIAL_COMPONENT_GEMINI_HANDOVER.md`

## Components Bucket

The `Components` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `3` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: tiny source-shape residue bucket, not broad component drift
- structured -> json:
  - no grouped `Components` bucket currently appears in
    `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - practical reading: runtime review support is now implemented in the gate checker,
    but the shared runtime report does not currently expose `Components` as a
    corpus-scale backlog bucket

Current bucket reading:

- canonical -> structured is mostly:
  - source-shape residue
  - accepted normalization
- structured -> json is currently:
  - selected-spell implementation review support
  - mostly model/display boundary unless a spell proves real runtime drift

Current working subbuckets:

- canonical -> structured:
  - `footnote_marker_residue`
  - `alternate_source_shape`
  - `true_components_drift`
- structured -> json:
  - `aligned`
  - `model_display_boundary`
  - `missing_runtime_components`
  - `missing_structured_components`
  - `real_runtime_drift`

Current gate-checker coverage:

- canonical -> structured `Components Review`: implemented
- structured -> json `Components Runtime Review`: implemented

What still needs to happen next:

- verify on live selected spells whether any true structured -> json component drift
  still exists beyond storage/display-shape differences
- decide whether `Components` needs to become a dedicated grouped runtime bucket in
  `SPELL_STRUCTURED_VS_JSON_REPORT.md`, or whether selected-spell review is enough
- keep `Components` and `Material Component` separate so V/S/M drift does not get
  blurred together with raw material-note drift

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\components\SPELL_COMPONENTS_BUCKET_TRACKER.md`

## Range/Area Bucket

The `Range/Area` bucket is also a two-phase bucket:

- `canonical -> structured`
- `structured -> json`

Current live status:

- canonical -> structured:
  - `172` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: mostly accepted normalization and source-display residue
  - latest canonical repair result:
    - the confirmed self-centered icon-loss mini-queue is now cleared on:
      - `antilife-shell`
      - `investiture-of-ice`
      - `investiture-of-wind`
      - `prismatic-spray`
      - `thunderwave`
    - total structured-vs-canonical mismatches dropped from `414` to `411`
    - the remaining self-centered canonical-side residue set is now `24`
- structured -> json:
  - `61` mismatches in `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`
  - current grouped kind: `value-mismatch`
  - practical reading: active runtime implementation-follow-up lane

Current bucket reading:

- canonical -> structured is mostly:
  - accepted normalization
  - source-shape residue
  - model/display boundary
- policy answer:
  - the structured `.md` layer should stay explicit and granular
  - it should not be compacted to imitate the terse canonical `Range/Area` header
  - icon-shape capture-loss cases belong to canonical-source repair, not structured
    drift
  - hyphen formatting in source-like display strings is not a runtime mechanics
    concern under the current JSON model
  - the preferred direction is more granular geometry facts, not prettier compact
    `Range/Area` strings
  - execution order is now:
    - define the canonical `Range/Area` fact schema in the structured `.md` layer
      first
    - then use that fact model to drive any follow-up JSON shaping
- structured fact taxonomy now split into:
  - core required facts:
    - `rangeOriginType`
    - `rangeDistance`
    - `rangeUnit`
    - `areaShape`
    - `areaSize`
    - `areaSizeUnit`
    - `areaSizeType`
  - common extension facts:
    - `areaHeight`
    - `areaWidth`
    - `areaThickness`
    - `followsCaster`
    - `shapeVariant`
    - `targetingOriginMode`
  - specialized mechanics-linked facts:
    - `secondaryArea`
    - `triggerZone`
    - `wallSegments`
    - `shapeSemantics`
    - `measuredSpatialDetails`
- normalization rule:
  - combined `Range/Area` display strings are derived summaries, not the
    authoritative structured payload
- structured `.md` field template direction:
  - minimum authoritative geometry fields should be written explicitly in the
    spell block
  - `Range/Area` may remain as a human-facing summary, but it should be derived
    from those fields
  - first concrete examples are now documented for:
    - `Alarm`
    - `Detect Magic`
    - `Lightning Bolt`
- execution inventory:
  - the current spell-by-spell work queues now live in
    `F:\Repos\Aralia\docs\tasks\spells\range-area\SPELL_RANGE_AREA_INVENTORY.md`
- canonical -> structured now also has a real subbucket map:
  - likely boundary:
    - compact canonical area size vs explicit structured shape (`36`)
    - self compact radius vs explicit structured shape (`23`)
  - likely source-shape residue:
    - canonical header thinner than structured geometry (`37`)
    - canonical footnote area vs normalized structured shape (`20`)
  - likely structured-side residue:
    - structured phantom `0-ft. None` area suffix (`26`)
    - structured parser scalar artifact (`5`)
  - likely real drift / active canonical-side follow-up:
    - structured missing self radius (`4`)
    - clear structured range drift (`4`)
    - range-origin or targeting drift (`2`)
    - clear area-size drift (`1`)
    - structured missing `Range/Area` header (`1`)
- structured -> json is the meaningful runtime lane and still needs spell-by-spell
  review to separate:
  - real implementation drift
  - model/display boundary
  - lower-value source-display residue

Current gate-checker coverage:

- canonical -> structured `Range/Area Bucket`: implemented
- structured -> json `Range/Area Runtime Review`: implemented
- selected-spell live refresh now also returns fresh structured -> json mismatch rows
  for this bucket in dev mode
- runtime unit groundwork:
  - the spell type layer and validator now support explicit `distanceUnit`,
    `rangeUnit`, `sizeUnit`, `heightUnit`, `widthUnit`, and `thicknessUnit`
    fields for spell geometry
  - the glossary spell card and range/area runtime gate block now honor those
    unit fields when present instead of assuming every numeric geometry value is
    implicitly feet
  - the structured-vs-json range formatter now also honors those unit fields, so
    explicit-unit backfills no longer create false drift immediately
  - pilot runtime backfills now exist on:
    - `alarm`
    - `detect-magic`
  - direct risky-spell widening has now also landed on:
    - `arcane-eye`
    - `bones-of-the-earth`
    - `create-or-destroy-water`
    - `flaming-sphere`
    - `tensers-floating-disk`
    - `otilukes-freezing-sphere`
    - `glyph-of-warding`
    - `mighty-fortress`
    - `wall-of-force`
    - `wall-of-ice`
    - `wall-of-light`
    - `wall-of-stone`
    - `wall-of-water`
  - the structured-vs-json formatter bug that rendered `feet` as `feets` has been
    fixed, so explicit-unit geometry no longer creates fake `Range/Area` drift
  - focused post-fix audits now show `Range/Area` clean on the widened risky sample
  - the broad corpus unit lane is now also genuinely complete:
    - a fresh live audit on `2026-04-08` found the earlier zero-backlog note was stale
    - actual live starting point was `291` spells with `602` missing explicit geometry
      unit fields
    - the corpus backfill updated `289` spell JSON files and added `598` explicit
      unit fields
    - post-backfill validation stayed green at `459 / 459` valid spell JSON files
    - the live runtime geometry-unit audit now finds `0` positive numeric geometry
      fields without explicit unit fields
  - important distinction:
    - the explicit-unit sub-lane is now complete
    - the broader `Range/Area` bucket is still not complete because it still has `61`
      structured -> json mismatches that are about geometry semantics, shape choice,
      and model/display boundaries rather than hidden units
    except where the remaining mismatch belongs to another bucket entirely
  - the older safe/risky runtime-unit inventory is now only historical execution
    context, not live backlog
  - the explicit-unit backfill sub-lane is now complete

What still needs to happen next:

- work from the current runtime subbucket map instead of treating the `61`-spell
  set as one undifferentiated lane
- current provisional runtime subbuckets:
  - self-centered emanation normalization drift (`7`)
  - structured phantom `0-ft. None` area residue (`31`)
  - distance-unit and special-range encoding split (`9`)
  - wall and constructed-shape alias drift (`10`)
  - structured scalar-area formatting residue (`5`)
  - runtime JSON missing area geometry (`4`)
  - shape-semantics boundary set (`5`)
  - structured missing `Range/Area` (`1`)
- fix the likely true runtime-drift buckets first:
  - self-centered emanation normalization drift
  - runtime JSON missing area geometry
  - explicit structured omission
- no further blanket explicit-unit backfill is required
- treat the reviewed risky-spell sample as structurally widened for `Range/Area`
  unless a retrospective pass later finds a better spatial formulation:
  - `flaming-sphere`
  - `create-or-destroy-water`
  - `tensers-floating-disk`
  - `arcane-eye`
  - `otilukes-freezing-sphere`
  - `glyph-of-warding`
  - `mighty-fortress`
  - `wall-of-force`
  - `wall-of-ice`
  - `wall-of-light`
  - `wall-of-stone`
  - `wall-of-water`
- keep direct review focused on the still-live `Range/Area` drift buckets rather than
  on unit omission, because the live corpus audit now shows `0` remaining positive
  numeric geometry fields without explicit units
- hold the risky queue for direct review because those spells may need wider model
  decisions around:
  - inches
  - diameter language
  - alternate shape modes
  - constructed wall / panel forms
- confirm the canonical-side likely real-drift buckets directly instead of treating
  the whole canonical-side `172` as one residual blur
- keep spell-casting mechanics discovery separate from plain geometry normalization
  so range/area cleanup does not silently absorb broader mechanic-model questions

Living tracker:
- `F:\Repos\Aralia\docs\tasks\spells\range-area\SPELL_RANGE_AREA_BUCKET_TRACKER.md`

This plan now assumes an important authority distinction:
- the upstream semantic authority for a spell is the official 2024 PHB spell description
- the validator, spell JSON, markdown references, and runtime behavior are implementation layers that should encode that authority as faithfully and consistently as the repo can currently support

That means validation is not only about "does the JSON match the schema?" It is also about whether the schema and the implemented data are representing the intended spell behavior clearly enough.

Current repo finding from the 2026-03-18 review:
- `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts` is the live repo authority for machine-checkable spell shape
- `F:\Repos\Aralia\docs\spells\SPELL_PROPERTIES_REFERENCE.md` is treated as explanatory only
- `F:\Repos\Aralia\docs\spells\SPELL_JSON_EXAMPLES.md` is also intended as explanatory only in its current rewritten form, but older workflow docs still preserve historical "template" or "source of truth" language around it
- any validation or workflow rule that still treats `SPELL_JSON_EXAMPLES.md` as canonical should be treated as legacy drift unless it is re-confirmed against the validator and live spell JSON files

Current disagreement-handling rule from the 2026-03-18 pass:
- if PHB text, validator, JSON, markdown, or runtime behavior meaningfully disagree, the mismatch should be surfaced for arbitration
- the process should not silently let JSON win over markdown, or validator win over JSON, when the disagreement affects behavior, modeling, or completion claims
- strict validation can still flag mismatches automatically, but final interpretation of meaningful disagreements is an arbitration step rather than an implicit auto-resolution rule
- all mismatches are worth recording, because the mismatch history may expose repeated schema, workflow, or documentation patterns over time
- prioritization should still favor bigger grouped failures first, so recurring mismatch families are handled before isolated one-off drift

Current execution-boundary rule from the 2026-03-20 pass:
- the system should treat the assistant as the collector, validator-runner, grouper, and implementer of explicit rulings
- the system should treat the project owner as the arbitrator for meaningful cross-layer mismatches
- the assistant may propose likely interpretations, but should not silently decide the winner when PHB text, validator, JSON, markdown, or runtime behavior meaningfully disagree
- the assistant should therefore optimize for:
  - detecting mismatches
  - grouping repeated mismatch families
  - presenting grouped buckets clearly
  - applying the rulings that are explicitly given

Current canonical-retrieval rule from the 2026-03-27 pass:
- raw official-source capture and Aralia normalization are now treated as two separate steps rather than one merged operation
- when a spell page is retrieved from D&D Beyond or another explicitly approved canonical source, the first job is to preserve the source output as-observed
- that raw capture should not be hand-normalized during retrieval, even when the source surface includes values the Aralia repo does not currently want to adopt directly
- examples of source-surface values that may still appear in the raw capture are:
  - legacy class labels mixed into a non-legacy page
  - subclass or domain entries that do not currently exist in the Aralia codebase
  - mixed `Available For` surfaces that expose both current and legacy access lines at the same time
- once the raw source capture exists, Aralia-specific normalization happens as a second step
- that normalization step is the place where the repo may:
  - ignore legacy class lines
  - ignore unsupported subclass or domain entries
  - apply class and subclass whitelists or blacklists
  - preserve unsupported access lines as future inclusion evidence rather than current runtime truth
- when the raw capture is stored inside a spell reference markdown file, it should live in a clearly separate section and remain commented out or otherwise made inert so validator-facing structured markdown parsing does not mistake it for repo truth
- the per-spell markdown file is now the only durable storage surface for raw canonical capture in this lane; the project should not keep a second giant corpus-wide JSON clone of the same copied spell content
- the one-time canonical retrieval tooling and finished retrieval tracker have been archived now that the lane is complete:
  - `F:\Repos\Aralia\scripts\archive\spell-canonical-retrieval\captureSpellCanonicalData.ts`
  - `F:\Repos\Aralia\scripts\archive\spell-canonical-retrieval\generateSpellCanonicalRetrievalTracker.ts`
  - `F:\Repos\Aralia\docs\tasks\spells\archive\spell-canonical-retrieval\SPELL_CANONICAL_RETRIEVAL_TRACKER.md`
- the temporary D&D Beyond auth-state file used during retrieval should not be archived; it should be deleted once the lane is done because it contains live session material
- `Referenced Rules` links copied from those canonical snapshot blocks should also be lifted into a dedicated rules-side glossary enrichment entry so the spell corpus can enrich the glossary without forcing every consumer to scrape spell markdown directly
- canonical retrieval now has two approved source paths:
  - raw HTTP detail-page capture for spells whose D&D Beyond page exposes the statblock directly
  - signed-in browser-backed capture fallback for spells whose mapped D&D Beyond URL renders a usable spell page in the browser but degrades to a marketplace shell or blank statblock through raw fetch
- those browser-only cases should be tracked as fallback work rather than being misclassified as dead-end failures
- a 2026-03-30 scope decision narrowed the active retrieval backlog further:
  - `Galder's Tower`
  - `Galders Speedy Courier`
  - `Blade of Disaster`
  are no longer active retrieval targets and should be treated as intentionally excluded from the canonical-retrieval queue
  - `Arcane Sword` remains the only active unresolved alternate-source retrieval target, with the approved source URL:
    `https://roll20.net/compendium/dnd5e/Arcane%20Sword#content`
- raw canonical retrieval should also preserve inline rule-tooltip links from the spell text as separate referenced-rule evidence
- those rule links should be stored as inert canonical evidence alongside the copied spell text, not folded into Aralia's structured spell fields during the retrieval step
- this split exists to preserve evidence while still allowing the repo to maintain its own class, subclass, and spell-model boundaries without losing sight of what the official source actually showed

Current implementation finding from the 2026-03-20 pass:
- the isolated spell-only validator path now runs successfully through `npm run validate:spells`
- the first grouped validator failure was repo-wide rather than spell-specific: the live validator required a top-level `source` field while the current spell JSON files did not provide one
- that mismatch was arbitrated on 2026-03-20: `source` is deprecated and should remain removed from spell JSON rather than being reintroduced
- after removing the dead `source` requirement from `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts`, `npm run validate:spells` now reports 469 valid spell JSON files and 0 invalid
- the markdown parity collector also exposed a parent issue in the spell reference lane: 23 spell reference markdown files were zero-byte placeholders rather than real structured docs
- that mismatch was arbitrated on 2026-03-20: blank or structurally missing spell reference docs may be regenerated directly from verified JSON
- a dedicated repair script now exists at `F:\Repos\Aralia\scripts\regenerateBlankSpellReferenceDocs.ts`
- after rebuilding those 23 blank docs and rerunning `npm run validate:spell-markdown`, the mismatch surface dropped from 1057 mismatches in 31 grouped buckets to 637 mismatches in 23 grouped buckets
- an official-source follow-up pass for those same 23 regenerated spell reference docs is now recorded in `F:\Repos\Aralia\docs\tasks\spells\SPELL_REGENERATED_REFERENCE_OFFICIAL_CHECK.md`
- that pass showed the blank-doc repair solved a markdown-presence problem, but it also exposed deeper `json-vs-phb` issues in the regenerated batch
- a 2026-03-22 follow-up widened the evidence set for the previously unresolved spell-page gaps by using user-approved secondary sources for the remaining Wildemount-era spells, so the regenerated-batch review is now substantially closed at the top-level canonical-facts layer even where the source-strength label is weaker than a direct D&D Beyond spell page
- two grouped follow-up issues are now recorded in the arbitration ledger:
  - missing class availability in local JSON even when the official spell page clearly lists classes
  - placeholder-like top-level defaults in part of the regenerated batch, where the regenerated markdown now mirrors local JSON that still appears materially wrong against official top-level spell facts
- the class-availability issue was arbitrated on 2026-03-23:
  - `classes` now stores only default/base class access
  - subclass/domain-specific access now lives in `subClasses`
  - markdown mirrors that split through `Classes` and `Sub-Classes`
- a dedicated backfill script now exists at `F:\Repos\Aralia\scripts\backfillRegeneratedSpellClasses.ts`
- the verified 23-spell regenerated batch has now been backfilled using that split model
- the ruling also surfaced one legacy spell outside the regenerated batch (`light`) that still embedded a subclass in `classes`; that spell was split to match the new rule so `npm run validate:spells` could remain green under the tightened validator
- the spell JSON schema now also requires every spell file to declare `subClasses` explicitly, even when the correct value is an empty array
- a corpus-wide backfill script now exists at `F:\Repos\Aralia\scripts\backfillMissingSpellSubClasses.ts`
- that script was used to add explicit `subClasses: []` arrays to the older spell JSON files that had never modeled the field, so subclass-access presence is now machine-checkable across the whole spell corpus
- the spell JSON schema now also requires `subClassesVerification` with the current values `unverified` or `verified`
- that verification field exists because an empty subclass list is otherwise ambiguous: `[]` by itself can mean either "no subclass/domain-specific access exists" or "nobody has checked yet"
- the corpus-wide backfill marks older spell files as `unverified` by default, while the narrow officially reviewed regenerated batch is explicitly promoted to `verified`
- the placeholder-default top-level facts lane has also now received a first grouped JSON repair pass through `F:\Repos\Aralia\scripts\repairRegeneratedTopLevelDefaults.ts`
- that pass updated clearly evidenced top-level canonical facts for the strongest regenerated-batch drift cases without widening scope into deeper effect-object remodeling
- the repaired files were mirrored back into their markdown references immediately, which is why the markdown parity totals did not change even though the canon-facing JSON quality improved
- this means the spell-truth lane now has an official-source verification branch in addition to the existing schema-validation and markdown-parity branches
- a corpus-wide D&D Beyond comparison script now exists at `F:\Repos\Aralia\scripts\reviewSpellCorpusAgainstDndBeyond.ts`
- that script widened the canon-facing review from the earlier 23-spell repaired batch to the broader spell corpus and now writes:
  - `F:\Repos\Aralia\docs\tasks\spells\SPELL_CORPUS_DNDBEYOND_REPORT.md`
  - `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-corpus-dndbeyond-report.json`
- a glossary-facing spell gate artifact now also exists at `F:\Repos\Aralia\public\data\spell_gate_report.json`
- that artifact is generated by `F:\Repos\Aralia\scripts\generateSpellGateReport.ts`
- the purpose of that artifact is not to replace the validator or the corpus reports; it exists so the glossary's dev-mode spell gate checker can visualize per-spell schema validity, class-access verification state, and canon-facing drift without trying to run Node-only review scripts in the browser
- an important 2026-03-23 correction was required before the corpus-wide report became trustworthy:
  - some D&D Beyond URLs expose a full spell page in the signed-in browser but return a marketplace shell or otherwise blank statblock through raw public HTTP fetch
  - the comparison script now treats those cases as `detail fetch incomplete` instead of falsely counting empty canonical fields as proof that the local corpus is wrong
- after that correction, the corpus-wide report stabilized at:
  - 469 local spells reviewed
  - 458 matched D&D Beyond listing rows
  - 11 unmatched listing rows
  - 861 grouped top-level mismatches across 10 bucket families
- the current largest corpus-wide buckets are now:
  - `json-vs-dndbeyond / subClassesVerification`
  - `json-vs-dndbeyond / subClasses`
  - `json-vs-dndbeyond / detail fetch incomplete`
  - `json-vs-dndbeyond / range/area`
  - `json-vs-dndbeyond / classes`
- this matters because the spell-truth lane now has a corpus-wide canon-facing work queue that is evidence-shaped enough to drive the next execution phase without relying on the earlier narrow regenerated-batch slice

## Primary Goal

We want to accomplish reliable spell-data validation and spell-reference parity, so the roadmap branch for spells can eventually reflect validated completion rather than only implementation presence.

To achieve that goal, we should:
1. define the authority model clearly
2. inventory the real spell-data shape currently in use
3. isolate and stabilize spell JSON schema validation
4. define markdown-to-JSON parity rules
5. build the markdown parity validator
6. connect the outcomes to roadmap progress signals

## 1. Define The Authority Model

We want to accomplish a clear hierarchy of truth between the upstream rules text, the repo schema, spell JSON, and spell markdown references.

To achieve that, we should:
- define the relationship between the PHB text and the repo schema
- define what the markdown files are supposed to do
- define how disagreements are handled

### Questions

- Is the official 2024 PHB spell description the upstream semantic authority, with `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts` acting as the machine-checkable repo schema?
- When JSON and the PHB text disagree, should that be treated as an implementation-modeling gap, a schema gap, or an intentional repo adaptation?
- How do we want to record PHB mechanics that depend on broader rule context and are not fully expressible in the current schema?
- What information must every arbitration record capture so grouped mismatch patterns are visible later?

### Answered Decisions So Far

#### Authority Order

The current working authority order is intentionally layered rather than collapsed into a single repo file.

At the top of that order sits the official 2024 PHB spell description. That rules text is the upstream semantic authority for what a spell is supposed to do, what limitations it carries, and what mechanics it is trying to express. This matters because the repo's structured fields do not always carry the full meaning by themselves, and some spells rely on broader rules knowledge that is not fully reducible to a handful of JSON fields.

Inside the repo, `F:\Repos\Aralia\src\systems\spells\validation\spellValidator.ts` is the machine-checkable authority for the spell shape that the codebase currently expects. In other words, when we ask "what fields and value shapes does the repo currently validate and accept?", the validator is the authoritative answer at that layer.

The spell JSON files are the concrete implementation instances that are supposed to satisfy the validator while also representing PHB spell intent faithfully enough for the repo's current needs.

The spell markdown files are not independent authorities. They are human-facing reference layers whose job is to explain or reflect the implemented state rather than silently define a competing schema.

This distinction is important because it means "repo authority" and "semantic authority" are not the same thing:
- PHB text is the upstream semantic authority
- the validator is the current repo schema authority
- JSON is the implemented data layer
- markdown is the explanatory/reference layer

#### Current Repo Reading About The Two Spell Docs

The current repo evidence points to this working rule:
- `spellValidator.ts` is authoritative for repo schema checks
- `SPELL_PROPERTIES_REFERENCE.md` is explanatory only
- `SPELL_JSON_EXAMPLES.md` is a curated orientation/examples surface, not a canonical schema source

More explicitly:

`F:\Repos\Aralia\docs\spells\SPELL_PROPERTIES_REFERENCE.md` should currently be read as explanatory only. Its own wording says it is a human-facing orientation layer and not the canonical validator definition. That means it should help humans navigate the spell shape, but it should not be treated as a document that gets to overrule the validator or live spell JSON.

`F:\Repos\Aralia\docs\spells\SPELL_JSON_EXAMPLES.md` should also currently be read as explanatory only, but with an important historical caveat. The file itself now says that it no longer claims to be the canonical schema reference and instead points readers to the validator and real spell JSON files. However, older workflow and migration docs still preserve historical wording that treats it as a template source or even a source of truth. Because of that drift, any process rule that still treats `SPELL_JSON_EXAMPLES.md` as canon should be treated as legacy workflow residue unless it has been re-confirmed against the validator and the current live spell JSON files.

So the ambiguity is no longer "what did these docs probably mean?" The ambiguity is "how much historical workflow language still needs cleanup so agents stop treating them like normative schema authorities."

#### Disagreement Handling And Arbitration

The current mismatch policy is:
- markdown vs JSON disagreements go to arbitration when they are meaningful
- JSON vs validator disagreements also go to arbitration when they are meaningful
- automation can detect and report these mismatches, but should not silently decide which layer is right
- all mismatches should be logged in an arbitration ledger
- the execution order for fixing them should prioritize grouped patterns and high-repeat mismatch families before isolated cases

This should be read strictly.

The process should not silently let JSON win over markdown just because JSON is closer to runtime, and it should not silently let the validator win over JSON just because the validator is the repo schema layer. If two implementation layers meaningfully disagree, that disagreement should be surfaced as an arbitration item instead of being auto-resolved by assumption.

That does not mean every mismatch requires a long debate. It means the system should record the mismatch, classify it, and make the arbitration decision explicit instead of burying the decision inside a silent edit or a one-off assumption.

Automation is still useful here, but its role is limited. Automation may detect, classify, and report mismatches. Automation should not silently decide final truth when the disagreement affects mechanics, modeling, or completion claims.

## 1A. Arbitration Ledger

We want to accomplish a durable record of spell-alignment mismatches, so arbitration decisions are not lost and repeated drift patterns can be discovered across the spell lane.

To achieve that, we should:
- record every detected mismatch in one ledger
- capture enough structure to group related issues together
- distinguish raw detection from final arbitration outcome
- prioritize recurring families before isolated one-off mismatches

### Questions

- Do we want mismatch families such as `markdown-vs-json`, `json-vs-validator`, `json-vs-phb`, and `runtime-vs-data`?
- Should the ledger track status such as `open`, `grouped`, `arbitrated`, `accepted-adaptation`, and `fixed`?
- What grouping key should take precedence: field path, mechanic family, spell family, or source-layer pair?
- When one mismatch belongs to a larger recurring family, should the ledger item point to a parent grouped issue?

### Answered Decisions So Far

#### Why The Ledger Exists

The arbitration ledger exists because the spell lane should not rely on memory or scattered chat context to keep track of disagreements between PHB semantics, validator expectations, JSON implementation, markdown references, and runtime behavior.

Every meaningful mismatch should be recorded somewhere durable. The reason for this is not that every mismatch deserves the same urgency. The reason is that once mismatches are captured consistently, repeated patterns become visible. Those repeated patterns are usually more important to fix first than isolated one-off mismatches.

So the ledger is not just a bookkeeping file. It is the mechanism that lets the project discover recurring mismatch families and resolve them in larger chunks.

#### Required Versus Optional Fields

Required fields:
- `id`
- `status`
- `family`
- `group_key`
- `spell`
- `field_or_mechanic`
- `source_a`
- `source_b`
- `mismatch_summary`
- `why_it_matters`
- `arbitration_needed`
- `resolution`

Optional fields:
- `notes`
- `links_to_related_entries`
- `phb_reference`
- `runtime_evidence`
- `introduced_by`
- `date_detected`

The required fields are intentionally the smallest set that still supports triage, grouping, and eventual arbitration. The ledger should not require a huge amount of prose just to record a mismatch, but it must require enough structure to let repeated patterns surface later.

The optional fields exist because not every mismatch will immediately have PHB citations, runtime evidence, or historical provenance attached to it. Those details are useful, but they should not block an entry from being recorded in the first place.

#### Grouping Principle

Current recommended group-key shape:
- `mismatch family / field_or_mechanic`

Examples:
- `markdown-vs-json / effects[].type`
- `json-vs-validator / targeting.validTargets`
- `json-vs-phb / Goodberry healing model`

This grouping principle should be read in plain language as:

"Spot the same problem in lots of places first."

That means the project should not primarily group mismatches by spell name. Spell name belongs at the entry level because it tells us where the mismatch was observed. The main grouping key should instead describe the repeated mismatch pattern, such as:
- the kind of mismatch
- the field or mechanic it concerns

This matters because a spell-by-spell grouping would hide larger problems. If fifteen spells all show the same `markdown-vs-json / effects[].type` mismatch, that is not fifteen separate strategic problems. It is one repeated family that should likely be resolved as a grouped pass.

So the working rule is:
- group by repeated mismatch pattern first
- use spell name as local evidence, not as the primary grouping key
- handle large repeated families before isolated one-off mismatches whenever practical

## 2. Inventory The Real Spell-Data Shape

We want to accomplish a complete picture of what spell JSON currently contains, so later tests are grounded in reality rather than assumptions.

To achieve that, we should:
- crawl all spell JSON files
- collect every field path currently used
- collect every observed value set for those fields
- separate structural values from free-text fields

### Questions

- Should it include free-text fields like `description`, `higherLevels`, or `aiContext.prompt`, or mostly ignore them?
- Should it record field presence and absence as well as observed values?
- Should it distinguish between top-level fields and nested effect-level fields?
- Should it flag one-off values and near-duplicates automatically?
- Should the crawler also flag places where the structured fields appear too weak to carry mechanics that currently live mostly in spell description text?

### Answered Decisions So Far

#### Crawler Scope

The crawler should include every field path it can find in the spell JSON files.

That means the crawler is not supposed to begin with a narrow opinionated whitelist of "important" fields. Its first job is to describe the real dataset honestly. If a field exists anywhere in the spell JSON corpus, the crawler should be able to surface it.

This includes:
- top-level structural fields
- nested effect fields
- nested targeting fields
- metadata fields
- free-text fields

The reason for this broad inclusion rule is that the project currently does not want the crawler itself to pre-decide what is relevant. Relevance can be filtered later in the UI or in downstream analysis, but the first inventory pass should not throw fields away silently.

#### Presence And Deviation Reporting

The crawler should not only list field paths and values. It should also help answer whether the spell corpus is structurally consistent.

More explicitly, the crawler output should make it possible to answer questions like:
- do all spells share the same core fields?
- which fields are present in almost every spell?
- which fields appear only in a minority of spells?
- which spells have fields that most other spells do not have?
- which spells are missing fields that the bulk of spells do have?

So presence and absence analysis is not optional. It is part of the intended output.

The crawler should therefore support:
- field presence counts across the entire spell corpus
- field absence visibility across the entire spell corpus
- identification of common fields versus rare fields
- identification of spells with unusually broad field coverage
- identification of spells with unusually sparse field coverage
- identification of concrete deviations, including which spells have more or fewer fields than the bulk

This is an explicit requirement:
- the crawler should record field presence
- the crawler should record field absence
- the crawler should record observed values where value inventory is useful

In other words, the crawler is not just a "what values exist?" tool. It is also a "which spells have this field, and which spells do not?" tool.

#### Free-Text Field Handling

Free-text fields should still be included in the crawler output, because the existence of those fields is part of the live spell shape.

However, for the first crawler pass, the important question for free-text fields is not "what exact prose is stored here?" The important questions are:
- does this field exist on the spell?
- is it empty?
- is it populated with some content?

So the crawler should treat free-text fields differently from structural fields:
- structural fields should be inventoried by field path, observed values, and presence patterns
- free-text fields should be inventoried primarily by existence and empty-versus-populated state

This means the first inventory pass should not try to make the raw text body of `description`, `higherLevels`, `aiContext.prompt`, and similar prose-heavy fields into the main analysis surface. The first pass should instead capture whether those fields are present and whether they actually contain content.

#### Top-Level Versus Nested Field Distinction

The crawler should explicitly distinguish between top-level fields and nested fields.

That means the inventory should preserve structural paths rather than flattening everything into one undifferentiated pool of names.

Examples:
- top-level field: `targeting`
- nested field: `targeting.validTargets`
- deeper nested field: `targeting.filter.creatureTypes`
- top-level field: `effects`
- nested effect-level field: `effects[].type`
- deeper effect-level field: `effects[].damage.dice`

This distinction matters because the project needs to know both:
- whether a spell has a major structural lane at all
- and what subfields are actually used inside that lane

So the crawler should preserve enough path information to make these levels visible, rather than treating `effects`, `effects[].type`, and `effects[].damage.dice` as if they were all the same kind of field.

#### One-Off Values And Near-Duplicates

The crawler should flag one-off values and near-duplicates automatically.

This should not be treated as a secondary nice-to-have. One-off values and near-duplicates are exactly the kinds of things that often expose:
- typos
- accidental schema drift
- legacy normalization leftovers
- fields that are technically present but not actually converged

The crawler does not need to make a final judgment about whether a one-off value is wrong. That is an arbitration and review question. But it should absolutely make those cases visible so they can be grouped and inspected instead of staying hidden in the raw dataset.

## 2A. Current Crawler Output Direction

We want to accomplish a crawler output that is actually usable by a human, rather than a giant static file that becomes hard to scan or mentally compare.

To achieve that, we should:
- keep the crawler output machine-readable
- support interactive querying
- avoid making a huge markdown wall of text the primary output

### Answered Decisions So Far

The current preferred output direction is:
- structured data first
- browseable/queryable surface second
- giant static prose dump last, if at all

More explicitly:

The crawler should produce structured data that can be queried by tools such as the Dev Hub. That structured output is the primary artifact because it supports:
- field browsing
- reverse value search
- presence and absence comparison
- deviation spotting

The primary human-facing surface should therefore be an interactive query tool rather than one giant static report. A static summary can still exist, but it should not be the main way a person is expected to understand the dataset.

#### Grouping And View Direction

The crawler output should support field-first viewing while still preserving spell-level and level-band context.

That means:
- field path should remain the primary grouping axis
- spell identity should remain available for reverse lookup and deviation inspection
- level information should remain available so the same field or value can be examined across level bands

In practical terms, this means the output should support both:
- "show me everything known about this field path"
- "show me which spells and levels carry this field or this value"

## 3. Isolate Spell JSON Schema Validation

We want to accomplish a validator that can reliably answer "do the spell JSON files conform to the current schema?" without unrelated systems blocking the result.

To achieve that, we should:
- isolate spell validation from charset and race validation
- ensure the script runs in the current environment
- make the result easy to run repeatedly

### Questions

- Should spell validation become its own script, separate from `F:\Repos\Aralia\scripts\validate-data.ts`?
- Should it read spell files from the manifest, from the filesystem, or both?
- Should it fail on the first invalid spell or report all invalid spells in one run?
- Do we want a dedicated npm script such as `validate:spells`?
- Should the spell validator be designed for CI use, local use, or both?
- Do we also want a second validation lane that flags "schema-valid but semantically under-modeled" spells for human review against PHB wording?

## 4. Define Markdown Parity Rules

We want to accomplish a precise rule for what it means for a spell markdown file to match its JSON counterpart.

To achieve that, we should:
- define which markdown fields must mirror JSON exactly
- define which markdown fields may summarize
- define how multi-effect spells should be represented
- define how trigger and filter details should be surfaced

### Questions

- Which markdown fields must be exact mirrors of JSON values?
- Are effect-type summaries like `DAMAGE, STATUS_CONDITION` acceptable, or must markdown mirror the exact effect array more literally?
- Should target filters appear separately in markdown when JSON uses `validTargets: creatures` plus a filter?
- Should markdown preserve a human-readable convention, or should it follow JSON vocabulary as closely as possible?
- Should description text be exact copy, close paraphrase, or free summary?
- Should markdown also call out PHB-important mechanics that are only partially represented in structured JSON fields?

### Answered Decisions So Far

#### Verified JSON Is The Markdown Mirror Target

The current direction is that the spell markdown files should say what the spell data files say, but only after the project has verified that the JSON representation is itself the correct repo-side representation to mirror.

This rule is deliberately stricter than "markdown should always copy JSON exactly." The project does not want markdown to become a second place where an unreviewed modeling mistake is repeated and made to look authoritative just because it already exists in structured data.

So the working rule is:
- markdown should mirror verified JSON for schema-facing factual fields
- markdown should not silently paraphrase those factual fields into a different meaning
- markdown should also not blindly copy JSON when the JSON itself has been identified as a meaningful mismatch that still needs arbitration

In plain language, the markdown files are supposed to say the same factual thing as the spell data files once the relevant JSON representation has passed through the repo's verification and arbitration process.

This means the markdown parity validator will eventually need to distinguish between:
- normal parity checks against verified JSON fields
- and known arbitration cases where the JSON representation is still under review and should not yet be treated as settled mirror-target truth

#### Default Scope Of Markdown Parity

The current default is that every structured, labeled markdown field should be treated as a schema-facing factual field unless it is clearly marked or written as explanatory prose.

In practical terms, this means the project should begin from the assumption that all of the normal spell-reference fields are parity fields. If a markdown file presents a labeled property as a fact about the spell, that property should match the verified JSON representation for the same spell.

This includes the ordinary structured spell facts such as:
- level
- school
- classes
- casting time
- range
- duration
- targeting
- effect typing
- saving throw and attack details
- damage, healing, utility, terrain, summoning, and other structured effect details
- structured filters, flags, and other explicit labeled properties

This default should only be relaxed where the content is clearly functioning as explanation rather than as a structured field report.

#### Deviations Must Be Ruled On Explicitly

When a structured markdown field deviates from the corresponding verified JSON field, that deviation should not be quietly normalized away and should not be silently treated as harmless drift.

Instead, the deviation should be surfaced as an arbitration item unless it is obviously a trivial formatting issue with no meaning impact.

The point of this rule is that a deviation between two structured layers usually means one of the following is true:
- the markdown is stale
- the JSON is stale or modeled poorly
- the validator and JSON are not expressing the intended mechanic clearly enough
- the field itself needs a better representation rule

So the current default rule is:
- all structured markdown fields are expected to mirror verified JSON
- any meaningful deviation from that expectation must be explicitly ruled on through the arbitration process

#### Separate JSON Effect Objects Should Stay Separate In Markdown

The current direction is that when a spell JSON file contains multiple distinct effect objects, the markdown should preserve that separateness instead of compressing those effects into one summary label.

This means the project should not prefer markdown shortcuts such as:
- `Effect Type: DAMAGE, STATUS_CONDITION`

when the underlying JSON more literally contains separate effect entries such as:
- one `DAMAGE` effect object
- one `STATUS_CONDITION` effect object

The reason for this rule is that summary labels are easier to read, but they also blur structure. Once multiple effect objects are collapsed into one line, it becomes harder to tell:
- how many effect objects really exist
- which nested properties belong to which effect
- whether two mechanics are represented independently or only implied by a combined label

So the markdown parity direction is:
- preserve the separate effect-object structure from JSON
- keep each effect object's properties associated with that effect object
- do not flatten multiple effect entries into a single combined type label just to make the markdown shorter

#### Markdown Should Follow Verified JSON Vocabulary Closely

The current direction is that structured markdown fields should follow verified JSON vocabulary as closely as possible instead of being rewritten into smoother but less precise human shorthand.

This is not a demand that the markdown become hostile to read. It is a demand that once the markdown presents a structured field as a factual statement about the spell, that field should stay close enough to the verified JSON wording that humans and tools can trust the mapping.

Human-friendly explanation is still allowed, but it should be kept in clearly separate explanatory text rather than mixed into the structured field values themselves.

#### Descriptive Prose Is Not A Word-For-Word Mirror Surface

The current direction is that prose-heavy text such as descriptions and similar explanatory content should not be treated as exact-text mirror targets in the same way that structured fields are.

For those fields, the first validation concerns are:
- whether the field exists
- whether it is populated
- whether it is semantically misleading or materially drifting from the intended spell behavior

That is different from demanding exact wording equality.

#### Markdown May Call Out Under-Represented PHB Mechanics

The current direction is that markdown may and should call out PHB-important mechanics when those mechanics are only partially represented in structured JSON fields.

This should not be done by silently falsifying the structured layer. Instead:
- structured fields should still mirror verified JSON
- under-represented mechanics should be surfaced in clearly separated explanatory text or notes
- meaningful under-representation should also feed arbitration or schema-gap tracking

#### Broad Target Categories And Narrowing Filters Should Both Be Shown

The current direction is that when the JSON uses a broad target category plus a narrowing filter, the markdown should show both pieces explicitly rather than collapsing them into a single shortcut label.

For example, if the JSON says:
- `validTargets: creatures`
- and a filter such as `creatureTypes: Beast`

the markdown should preserve those as separate facts, such as:
- `Valid Targets: creatures`
- `Target Filter Creature Types: Beast`

The project should not collapse those two layers into a single human shortcut such as `Valid Targets: beasts`, because that hides the actual data structure and makes it harder to tell:
- what the broad target class is
- what the narrowing rule is
- whether the repo is modeling targeting with categories, filters, or both

So the parity direction is:
- preserve the base target category from JSON
- preserve the narrowing filter from JSON
- do not flatten those two layers into a single simplified markdown label

## 5. Build The Markdown-vs-JSON Validator

We want to accomplish an automated check that can tell us when spell markdown references drift away from the corresponding JSON.

To achieve that, we should:
- parse the markdown reference structure
- map markdown fields to JSON fields
- compare only the approved parity fields
- report mismatches clearly

### Questions

- Should the validator parse markdown by its bullet labels, or should the markdown format be strengthened first to make parsing safer?
- Should the validator only check fields present in both files, or also flag missing markdown fields?
- Should it auto-detect the matching JSON by basename and level folder?
- Should it output human-readable reports, machine-readable JSON, or both?
- Should it support both strict and advisory modes?

### Answered Decisions So Far

#### The Validator Should Parse A Strengthened Structured Markdown Format

The validator should parse markdown through explicit labeled structure rather than trying to infer meaning from loose prose. If the current markdown format is too inconsistent for reliable parsing, the format should be strengthened rather than forcing the validator to guess.

#### The Validator Should Check Missing Fields As Well As Present Fields

The validator should not limit itself to fields that happen to exist in both layers. It should also flag:
- structured markdown fields that are missing even though verified JSON contains the corresponding data
- structured markdown fields that claim facts for which no corresponding verified JSON field currently exists

Absence is part of parity, not just presence.

#### JSON Pairing Should Be Automatic

The validator should auto-detect the matching JSON file by stable spell identity, using basename and level-band location as the normal pairing rule.

#### The Validator Should Emit Both Human-Readable And Machine-Readable Results

The validator should output:
- a human-readable report for review and arbitration
- a machine-readable artifact for grouping, tooling, and later automation

#### The Validator Should Support Strict And Advisory Modes

The validator should support:
- strict mode for settled parity rules
- advisory mode for softer findings, in-progress format migration, and known arbitration-sensitive areas

## 6. Decide How Descriptive Text Is Treated

We want to accomplish clarity about whether descriptive prose is part of validation or just reference context.

To achieve that, we should:
- separate structural validation from prose validation
- decide whether prose should be compared mechanically at all
- define where underrepresented mechanics should be noted

### Questions

- Should `description` and `higherLevels` be validated for exact text match?
- If not exact, should they at least be checked for presence?
- If a spell's JSON fields underrepresent behavior but the description explains it, should that count as a schema problem?
- If a spell's PHB behavior relies on wider rules knowledge, should the markdown surface that dependency explicitly instead of pretending the local JSON fields are fully self-explanatory?
- Should the crawler capture prose-derived capabilities as a later review queue rather than part of the strict validator?

### Answered Decisions So Far

#### Prose Should Be Checked For Presence Before Exactness

The current direction is that prose-heavy fields such as `description` and `higherLevels` should first be validated for existence and populated state rather than exact text equality.

#### Under-Represented Behavior Counts As A Modeling Concern

If a spell's structured JSON fields under-represent behavior that still matters to understanding the spell, that should count as a schema or modeling concern rather than being dismissed just because the prose happens to explain it.

The prose can reveal the problem, but it should not be used to excuse the problem.

#### Wider Rules Dependencies Should Be Surfaced Explicitly

If a spell's PHB behavior relies on wider rules knowledge or interactions that are not self-evident from the local structured fields, the markdown should surface that dependency explicitly instead of pretending the local JSON is fully self-explanatory.

#### Prose-Derived Capability Gaps Should Form A Later Review Queue

The crawler and the strict parity validator should not try to infer full semantic behavior from prose in the first pass.

However, when prose clearly points at under-modeled or under-expressed behavior, those cases should be captured as a later review queue that can feed arbitration, schema-gap work, and roadmap validation milestones.

## 7. Connect Validation To Roadmap Progress

We want to accomplish roadmap branches and nodes that reflect validated spell-data progress rather than only implementation existence.

To achieve that, we should:
- define validation milestones
- define what counts as validated
- define how crawler results and test results affect roadmap state

### Questions

- Should there be a roadmap branch specifically for `Spell Data Validation` or `Spell JSON Schema Convergence`?
- What are the child nodes under that branch?
- Should completion require both JSON-schema validation and markdown-parity validation?
- Should completion also require a "PHB semantics adequately represented" review gate for high-complexity spells?
- Should the crawler inventory itself be a roadmap milestone, or only a prerequisite artifact?
- How should partial progress be shown: by spell level, by capability area, or by validation layer?

### Answered Decisions So Far

#### There Should Be A Dedicated Spell Data Validation Branch

The roadmap should include a dedicated validation-oriented branch rather than hiding this work inside generic spell progress.

The clearest current name is:
- `Spell Data Validation`

#### Child Nodes Should Follow Validation Layers First

The current recommended child nodes are:
- `Spell Field Inventory`
- `Spell JSON Schema Validation`
- `Spell Markdown Parity Validation`
- `Spell Alignment Arbitration`
- `Spell PHB Semantics Review`

This keeps progress claims tied to the kind of validation that has actually happened.

#### Completion Requires More Than Schema Validity Alone

Validated completion for this branch should require more than "JSON passed the validator."

The current direction is:
- JSON schema validation is required
- markdown parity validation is required
- meaningful mismatches must be recorded and ruled on through arbitration
- high-complexity spells may also require explicit PHB-semantics review before the branch can honestly claim validated completion

#### The Crawler Inventory Is A Real Milestone

The crawler inventory should count as a real roadmap milestone because it establishes the observable field and value landscape that all later validation work depends on.

#### Partial Progress Should Be Shown By Validation Layer First

The best primary progress view is by validation layer first. Within those layers, secondary breakdowns can then be shown by spell level, repeated mismatch family, or selected capability area.

## 7A. Current Validation State

We want to accomplish a truthful snapshot of what has already been implemented in the validation lane, so later work is anchored in verified current state rather than assumed progress.

To achieve that, we should:
- record which validation tools already exist
- record which of them already run successfully
- distinguish tooling failures from real dataset failures

### Current State

The spell field inventory crawler already exists and is queryable through the standalone explorer page.

The isolated spell-only JSON schema validator also now exists as a working runtime path:
- `F:\Repos\Aralia\scripts\validateSpellJsons.ts`
- `npm run validate:spells`

The markdown-vs-JSON parity collector now also exists as a working runtime path:
- `F:\Repos\Aralia\scripts\validateSpellMarkdownParity.ts`
- `npm run validate:spell-markdown`
- grouped human-readable report: `F:\Repos\Aralia\docs\tasks\spells\SPELL_MARKDOWN_PARITY_REPORT.md`
- machine-readable artifact: `F:\Repos\Aralia\.agent\roadmap-local\spell-validation\spell-markdown-parity-report.json`

That validator now boots and scans the live spell dataset instead of failing immediately on environment issues.

The first concrete dataset finding from that run was a grouped `json-vs-validator / source` mismatch:
- scanned spell JSON files: 469
- valid under the previous validator requirement: 0
- invalid under the previous validator requirement: 469
- repeated failure pattern: the validator required a top-level `source` field and the current spell JSON files did not provide one

That mismatch has now been arbitrated and resolved:
- ruling: `source` is deprecated and should stay removed from live spell JSON
- implementation change: remove the dead `source` requirement from the validator
- current result: `npm run validate:spells` now reports 469 valid spell JSON files and 0 invalid

That means the spell JSON schema validation lane is now functionally in place and currently green for the live dataset.

The markdown parity lane is also now functionally in place as a collector. The first full grouped run currently reports:
- 418 markdown files scanned
- 1945 collected mismatches
- 33 grouped mismatch buckets

The largest current grouped buckets include:
- `markdown-vs-json / Source`
- `markdown-vs-json / Status`
- `markdown-vs-json / Utility Type`
- `markdown-vs-json / Effect Type`
- `markdown-vs-json / Valid Targets`
- `markdown-vs-json / effects structure`

That means the next execution step is no longer "build the collector." That step is complete.

The next execution step is grouped arbitration of the markdown parity buckets, followed by implementation of the rulings and reruns of the collector.

Current grouped arbitration progress:
- `markdown-vs-json / Status` has been ruled on and implemented
- ruling: remove Status from the spell reference markdown files entirely
- reason: Status is workflow/progress metadata, not spell-truth data
- follow-through: the spell reference markdown set has been updated and the parity collector should now be rerun so the remaining mismatch surface reflects only unresolved buckets
- `markdown-vs-json / Source` has also been ruled on and implemented
- ruling: remove Source from the spell reference markdown files entirely
- reason: Source citations are not backed by the live spell JSON parity layer and should not remain in the structured parity block
- follow-through: the spell reference markdown set has been updated and the parity collector should now be rerun so the remaining mismatch surface reflects only unresolved buckets
- `markdown-vs-json / Utility Type` has also been ruled on and implemented
- ruling: whenever the relevant JSON effect is `UTILITY`, the spell reference markdown must include `Utility Type`
- value rule: the markdown value should mirror the exact JSON `utilityType` value rather than a human-friendly paraphrase
- follow-through: the spell reference markdown set has been updated and the parity collector should now be rerun so the remaining mismatch surface reflects only unresolved buckets
- `markdown-vs-json / missing reference body` has also been ruled on and implemented
- ruling: blank or structurally missing spell reference docs may be regenerated directly from verified JSON
- implementation: the repair is now scripted in `F:\Repos\Aralia\scripts\regenerateBlankSpellReferenceDocs.ts`
- measured result: rebuilding the 23 zero-byte spell reference docs reduced the parity surface from 1057 mismatches in 31 grouped buckets to 637 mismatches in 23 grouped buckets

## 8. Choose The Execution Order

We want to accomplish this with the least confusion and rework.

To achieve that, we should probably do the work in this order:
1. define the authority model
2. build the crawler and inventory
3. isolate spell JSON schema validation
4. define markdown parity rules
5. build the markdown parity validator
6. connect results to the roadmap

### Questions

- Do we agree with this order?
- Should roadmap branching happen before the crawler, or after we know the actual field and value landscape?
- Should markdown parity wait until after the JSON schema validation path is stable?

### Answered Decisions So Far

The current direction is that roadmap shaping for spell-data validation should follow the crawler and the schema-reading work, not precede it.

The reason is straightforward:
- the crawler tells us what the dataset actually contains
- schema validation tells us what the repo currently accepts
- only after that do we have a trustworthy basis for roadmap nodes that claim validation progress

So the current working order is:
1. settle enough authority questions to avoid building the wrong tool
2. build and use the crawler
3. use the crawler findings to shape the validation lanes
4. only then let the roadmap branch reflect those validation milestones

This keeps the roadmap from being built on guesses about the dataset.

## 8A. Execution Trajectory

We want to accomplish a trustworthy spell-truth system without silently turning collection work into hidden arbitration.

To achieve that, the trajectory should be:
1. keep the isolated spell JSON schema validator working and green
2. build the markdown parity collector so structured markdown-vs-JSON drift can be detected automatically
3. group raw mismatches into recurring families rather than flooding the project with one-off spell-by-spell noise
4. bring grouped mismatch buckets to the project owner for arbitration
5. apply the explicit ruling
6. rerun the collectors and validators
7. repeat until the remaining mismatches are either resolved, accepted adaptations, or queued for PHB-semantics review

This means the assistant's role is operational and evidentiary:
- build the tools
- run the tools
- collect the failures
- group the failures
- keep the ledger and roadmap honest

This means the project owner's role is decisional:
- decide which layer is correct when the mismatch is meaningful
- decide whether the repo should adapt the schema, JSON, markdown, or runtime behavior
- decide when a mismatch represents a true bug versus an accepted adaptation

The practical next execution step after the now-green spell JSON schema lane is:
- build the markdown-vs-JSON parity collector
- run it across the spell reference markdown files
- record and group the first mismatch families
- present those grouped buckets for arbitration instead of auto-fixing them

## Practical First Move

We want to accomplish forward progress without overcommitting to the wrong validation rules.

To achieve that, the first concrete artifact should probably be a spell-data crawler that inventories field paths and observed value sets across all spell JSON files.

### Questions

- Should that crawler ignore free-text descriptive fields for the first pass?
- Should its first output be a Markdown report, a JSON artifact, or both?
- Should it group results by field path only, or also by spell level?

### Answered Decisions So Far

The first concrete artifact should be a crawler that inventories the live spell JSON dataset and feeds a queryable tool surface.

The current preferred first-pass behavior is:
- include all fields
- treat free-text fields as presence-and-emptiness signals rather than prose-analysis targets
- preserve top-level and nested path distinction
- record presence, absence, and observed values
- surface one-off values and near-duplicates
- support field-first grouping while preserving spell and level context

The current preferred output direction is:
- structured data artifact first
- interactive query surface second
- optional summary reporting after that

## 9. Consolidated Working Answers

The following working answers now guide the spell-data validation lane:

- structured markdown fields should mirror verified JSON by default
- meaningful deviations between layers should be recorded and surfaced for arbitration
- all structured labeled markdown fields are parity fields unless they are clearly explanatory prose
- separate JSON effect objects should stay separate in markdown
- broad target categories and narrowing filters should both remain visible in markdown
- structured markdown fields should use verified JSON vocabulary as closely as possible
- prose-heavy fields should first be validated for presence and populated state rather than exact text equality
- prose may surface PHB-important mechanics that are under-represented structurally, but those notes should remain separate from the structured parity layer
- the crawler should include every field path, preserve top-level versus nested structure, record presence and absence, and flag one-off values or near-duplicates
- free-text fields should be tracked primarily by existence and populated state in the first pass
- the markdown parity validator should use explicit structured fields, check both missing and present fields, pair files automatically, emit both human-readable and machine-readable output, and support strict and advisory modes
- the roadmap should track this work in a dedicated `Spell Data Validation` branch with layered milestones
- the isolated spell-only schema validator now exists as a working command and currently passes across the live spell dataset
- the spell validation lane now also includes a repeatable repair step for zero-byte spell reference docs so blank placeholders stop polluting the grouped parity results

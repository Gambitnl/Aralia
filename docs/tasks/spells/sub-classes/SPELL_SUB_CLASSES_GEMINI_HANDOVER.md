# Gemini Handover: Sub-Classes Bucket

Last Updated: 2026-04-10

## Mission

Take over the `Sub-Classes` bucket in the spell-truth lane for Aralia.

Primary goal:

- fix `canonical -> structured` first

Secondary goal:

- use those fixes to drive `structured -> json`

Do not start with the runtime JSON backlog in isolation unless a spell proves to be
a pure runtime issue after the structured layer is already correct.

## Current Live Counts

Use these as the current starting numbers unless fresher reports are regenerated:

- canonical -> structured:
  - `156`
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- structured -> json:
  - `45`
  - source: `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

## Why Canonical-First

The structured `.md` block is the interpreted layer.

The glossary spell card renders from runtime spell JSON.

So the clean order is:

1. make sure canonical subclass/domain access is represented correctly in the
   structured `.md`
2. then make sure runtime JSON matches that normalized structured layer

If step 1 is skipped, the runtime lane stays noisy and hard to classify.

## Active Canonical -> Structured Subbuckets

Work the canonical-side bucket using these subbuckets:

1. `missing_structured_subclasses`
2. `incomplete_structured_subclasses`
3. `repeated_base_canonical_entries`
4. `legacy_or_unsupported_canonical_entries`
5. `canonical_label_variant_residue`
6. `malformed_structured_subclass_field`
7. `canonical_source_shape_gap`

Recommended order:

1. `missing_structured_subclasses`
2. `incomplete_structured_subclasses`
3. `malformed_structured_subclass_field`
4. `legacy_or_unsupported_canonical_entries`
5. `repeated_base_canonical_entries`
6. `canonical_label_variant_residue`
7. `canonical_source_shape_gap`

## What Counts As What

### Real Drift

- canonical snapshot clearly shows subclass/domain access
- structured `.md` does not carry it, or carries an incomplete set

### Normalized Difference

- canonical snapshot preserves repeated-base subclass/domain lines
- structured `.md` or JSON intentionally normalizes those away because the base
  class already exists in `Classes`

### Source-Shape Residue

- canonical subclass/domain access is visible inside raw `Available For`
- the audit/parser layer does not yet derive a comparable normalized field cleanly

### Model Gap

- repeated-base subclass policy
- verification semantics
- handling of legacy/unsupported canonical subclass lines

## Important Files

Bucket docs:
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\sub-classes\SPELL_SUB_CLASSES_GEMINI_HANDOVER.md`

Shared spell-truth docs:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_DATA_VALIDATION_PLAN.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_TRACKER.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_CANONICAL_SYNC_FLAGS.md`
- these shared docs were refreshed for this handoff and should be treated as the
  main project-visible status surface for the bucket

Live reports:
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_CANONICAL_REPORT.md`
- `F:\Repos\Aralia\docs\tasks\spells\SPELL_STRUCTURED_VS_JSON_REPORT.md`

Glossary gate checker implementation:
- `F:\Repos\Aralia\src\hooks\useSpellGateChecks.ts`
- `F:\Repos\Aralia\src\components\Glossary\GlossaryEntryPanel.tsx`
- `F:\Repos\Aralia\public\data\spell_gate_report.json`

Representative spell:
- `F:\Repos\Aralia\docs\spells\reference\level-5\hold-monster.md`
- `F:\Repos\Aralia\public\data\spells\level-5\hold-monster.json`

## Execution Plan

### Phase 1: Canonical -> Structured Review

- scan the canonical-side `Sub-Classes` residue
- sort spells into the canonical subbuckets above
- prioritize:
  - clearly missing structured subclass fields
  - clearly incomplete structured subclass fields
- do not immediately treat repeated-base lines as runtime bugs

### Phase 2: Structured -> JSON Follow-Through

For spells whose structured layer is now correct:

- review whether runtime JSON is still behind
- use the glossary:
  - `Sub-Classes Review`
  - `Sub-Classes Runtime Review`
- then classify the runtime issue as:
  - real runtime drift
  - verification lag
  - repeated-base normalization
  - malformed structured-value case

### Phase 3: Policy / Model Review

Escalate only the true bucket-level questions:

- repeated-base subclass storage policy
- verification-state semantics
- legacy/unsupported canonical subclass evidence policy

## Docs To Update While Working

Do not create a parallel planning system elsewhere. Keep this bucket visible inside
the shared spell-truth docs.

Update while working:

- `SPELL_SUB_CLASSES_BUCKET_TRACKER.md`
- `SPELL_DATA_VALIDATION_PLAN.md`
- `SPELL_CANONICAL_SYNC_TRACKER.md`
- `SPELL_CANONICAL_SYNC_FLAGS.md`

## What Not To Do

- do not collapse `canonical -> structured` and `structured -> json` into one note
- do not treat raw canonical evidence as automatically JSON-ready
- do not remove repeated-base entries from the canonical snapshot evidence surface
- do not create a second spell-truth planning system outside the spell task docs

## Handoff Status

As of this handoff:

- bucket framing has been shifted to canonical-first
- the glossary gate checker already has:
  - `Sub-Classes Review`
  - `Sub-Classes Runtime Review`
- the docs have been updated to reflect:
  - canonical-side priority
  - subbucket structure
  - remaining runtime follow-through work
  - the exact shared files Gemini should keep updated while working

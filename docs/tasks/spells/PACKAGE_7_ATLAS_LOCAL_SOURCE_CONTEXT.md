# Package 7 - Atlas Local Source Context

Status: durable Jules-readable context extracted from the operator's ignored
local Atlas copy after Jules could not see those files from a clean checkout.

## Why This Exists

Package 7 needs Jules to repair the Spell Pipeline Atlas from GitHub-visible
state. The current Jules session could not see the operator's ignored local
Atlas files and proposed an empty replacement with empty `BUCKET_META`,
empty `EXECUTION_BY_BUCKET`, and a dummy archive constant.

That plan must not be approved. An empty Atlas would make the audit surface
look quiet while erasing the authored bucket map that the spell project uses as
checkpoint context.

This file gives Jules enough non-runtime source context to rebuild or restore a
meaningful tracked Atlas without committing raw Symphony state, dashboard
receipts, local run logs, or ignored orchestration artifacts.

## Local Ignored Files Observed

These files existed in the operator checkout but were hidden from clean GitHub
history by ignore boundaries:

- `misc/spell_pipeline_atlas.html`
- `src/spell-pipeline-atlas.tsx`
- `src/components/DesignPreview/steps/PreviewSpellDataFlow.tsx`

The standalone entrypoint was small and direct:

- `misc/spell_pipeline_atlas.html` mounts `#root` and loads
  `/src/spell-pipeline-atlas.tsx`.
- `src/spell-pipeline-atlas.tsx` imports
  `./components/DesignPreview/steps/PreviewSpellDataFlow`, applies
  `./index.css`, checks that `#root` exists, and renders
  `<PreviewSpellDataFlow />` inside `React.StrictMode`.

The HTML comment still named the removed path
`src/components/SpellPipelineAtlas/SpellPipelineAtlasPage.tsx`; Package 7
should update that stale comment or replace it with accurate historical text.

## Minimum Non-Vacuous Atlas Shape

The ignored `PreviewSpellDataFlow.tsx` was not an empty placeholder. It had a
large authored map with these core pieces:

- typed bucket rows in `BUCKET_META`
- typed execution blocks in `PhaseBlock[]`
- `STUB_EXECUTION` fallback for intentionally unauthored buckets
- authored execution constants for real buckets
- `EXECUTION_BY_BUCKET` mapping bucket names to authored execution constants
- exported `PreviewSpellDataFlow` React component

The observed `BUCKET_META` bucket list was:

- `Classes`
- `Sub-Classes`
- `Casting Time`
- `Range/Area`
- `Components`
- `Material Component`
- `Duration`
- `Description`
- `Higher Levels`
- `School`
- `Damage Type`
- `Attack-Roll Riders`
- `Conditions`
- `Summoned Entities`
- `Structured Markdown`

The observed `EXECUTION_BY_BUCKET` map registered these bucket-to-constant
links:

- `Classes` -> `CLASSES_EXECUTION`
- `Sub-Classes` -> `SUB_CLASSES_EXECUTION`
- `Casting Time` -> `CASTING_TIME_EXECUTION_CANONICAL_FIRST`
- `Range/Area` -> `RANGE_AREA_EXECUTION`
- `Components` -> `COMPONENTS_EXECUTION`
- `Material Component` -> `MATERIAL_COMPONENT_EXECUTION`
- `Duration` -> `DURATION_EXECUTION`
- `Description` -> `DESCRIPTION_EXECUTION`
- `Higher Levels` -> `HIGHER_LEVELS_EXECUTION`
- `School` -> `SCHOOL_EXECUTION`
- `Damage Type` -> `DAMAGE_TYPE_EXECUTION`
- `Attack-Roll Riders` -> `ATTACK_ROLL_RIDERS_EXECUTION`
- `Conditions` -> `CONDITIONS_EXECUTION`
- `Summoned Entities` -> `SUMMONED_ENTITIES_EXECUTION`
- `Structured Markdown` -> `STRUCTURED_MARKDOWN_EXECUTION`

The local audit finding was caused by an older
`CASTING_TIME_EXECUTION` constant that was still declared but no longer
registered in `EXECUTION_BY_BUCKET`, because the canonical-first
`CASTING_TIME_EXECUTION_CANONICAL_FIRST` map had become the live entry.

## Required Recovery Behavior

Jules may not satisfy Package 7 by creating an empty Atlas. A valid Package 7
repair must do one of these:

1. Restore or recreate a tracked Atlas with meaningful `BUCKET_META` and
   `EXECUTION_BY_BUCKET` content for the bucket list above.
2. If the historical local source is not available, rebuild a minimal but honest
   Atlas that preserves the bucket names, tracker paths, implementation gates,
   authored-vs-stub distinction, and execution-map registration shape.
3. Resolve the old `CASTING_TIME_EXECUTION` orphan honestly by removing it,
   renaming it as explicit archival context, or folding its useful note into the
   live canonical-first casting-time map.

A passing audit is only useful if it proves the Atlas still has meaningful
bucket registration. Empty maps, dummy archive variables, and vacuous success
are package failures.

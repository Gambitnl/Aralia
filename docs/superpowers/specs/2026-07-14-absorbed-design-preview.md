# Design Preview Tool — Absorbed Spec

**Absorbed:** 2026-07-15  
**Evidence:** docs/projects/design-preview (now deleted); verification in `/misc/design.html`

## What It Is

Design Preview is a standalone developer tool at `/misc/design.html` for visual checks, style comparisons, and content review outside the main game. The tool lives in `src/design-preview.tsx` and routes to `src/components/DesignPreview/DesignPreviewPage.tsx`. It exposes 25+ preview lanes (race, class, equipment, combat, spells, icons, components, environment, biomes, 3D tests, and more) with style variants and visualizer integration.

## Lane Steward Map

When splitting or moving large step files (PreviewComponents.tsx, PreviewCombat.tsx, etc.), the table below names the owner system and required proof:

| Preview lane family | Source-backed steward | Large-step split candidates | Required proof before move |
|---|---|---|---|
| Character creation | character-creator; racial-mechanics | PreviewRace.tsx, PreviewClass.tsx, PreviewStats.tsx, etc. | Rendered misc/design.html?step=<lane> screenshot + focused step test |
| Equipment / trade / dialogue | character-sheet / trade-ui / dialogue | PreviewEquipment.tsx, PreviewTrade.tsx, PreviewDialogue.tsx | Screenshots of interactive state + rendered parity proof |
| Combat suite | combat; design-preview-scenarios owns child routing | PreviewCombat.tsx, PreviewCombatSandbox.tsx, PreviewCombatScenarios.tsx | Combat scenario smoke path + rendered screenshot (useTurnManager/useAbilitySystem hooks live) |
| Environment / 3D | environment; three-d-modal | PreviewEnvironment.tsx, PreviewBiome.tsx, PreviewThreeDTest.tsx | Rendered scene screenshot; PreviewEnvironment needs test anchor if split |
| UI library | ui-primitives; glossary-ui | PreviewComponents.tsx (largest candidate), PreviewTables.tsx, PreviewIcons.tsx | PreviewTables.test.tsx anchor + rendered preview screenshot |
| Glossary / spells | glossary-ui; spells | PreviewSpellGlossary.tsx, PreviewSpellDataFlow.tsx | Glossary-provider render check + spell-gate screenshot |

Dormant helper: `PreviewMdLibrary.tsx` is not currently routed by DesignPreviewPage.tsx.

## Manual Checklist

Use this when a visual pass is requested (from RUNBOOK.md):

1. Open `/misc/design.html` in a local dev server.
2. Change step via query or header lanes; confirm preview pane updates.
3. Switch style variants; confirm label and live marker update.
4. Test visualizer controls against localhost:3847.
5. Capture browser screenshots for each lane under review.

## Implementation Files

- `misc/design.html` — standalone shell
- `src/design-preview.tsx` — React mount
- `src/components/DesignPreview/DesignPreviewPage.tsx` — multi-lane router
- `src/components/DesignPreview/VariantSwitcher.tsx`, `StyleVariants.tsx` — style variants
- `src/components/DesignPreview/steps/*` — lane implementations (25+ files)
- `src/md-library-entry.tsx`, `misc/md_library.html` — docs library reuse

## Next Steward

Scenario-specific Tactical Sandbox work routes through `docs/projects/design-preview-scenarios/SUBPROJECTS.md`. The broad Design Preview steward preserves the lane map and routes split/move work through the checklist above.

# Glossary UI North Star

Status: active  
Last updated: 2026-05-31

## Purpose
Keep the glossary feature discoverable as a working project surface. The feature is already implemented; this folder now captures current behavior, integration points, and open risks before further extension.

## Scope
This project covers the glossary modal and content browsing experience under:
- `src/components/Glossary/*`
- glossary data loading and bundle/index generation
- game entry points that open glossary links and initialize the modal

## Implemented State
- `Glossary.tsx` is the runtime modal container and wires search, selection, spell checks, keyboard navigation triggers, and open-to-term behavior.
- Search and category browsing are implemented with recursive expansion in `hooks/useGlossarySearch.ts` and `GlossarySidebar.tsx`.
- Modal geometry and gesture behavior is implemented in `hooks/useGlossaryModal.ts`.
- Content render and in-term links are implemented in `GlossaryContentRenderer.tsx`, `FullEntryDisplay.tsx`, and `GlossaryEntryTemplate.tsx`.
- Spell diagnostics and spell-level refresh are implemented in `src/components/Glossary/spellGateChecker/*` and invoked from `Glossary.tsx`.
- Rule chapters and grouped rule trees are implemented in `glossaryRuleChapters.ts`.
- Data provider integration is implemented by:
  - `src/context/GlossaryContext.tsx` (reads `public/data/glossary_bundle.json`)
  - `src/components/providers/AppProviders.tsx`
  - `src/components/providers/DataLoaderGate.tsx`
  - `src/App.tsx` and `src/components/layout/GameModals.tsx` modal wiring

## File Map (Primary)
- `src/components/Glossary/Glossary.tsx` - container modal, fetch lifecycle, open/close, initial term selection.
- `src/components/Glossary/GlossarySidebar.tsx` - tree with categories, search toggle, term highlighting.
- `src/components/Glossary/GlossaryEntryPanel.tsx` - right side content pane and navigation controls.
- `src/components/Glossary/GlossaryEntryTemplate.tsx`, `GlossaryContentRenderer.tsx`, `FullEntryDisplay.tsx` - markdown render + term link handling.
- `src/components/Glossary/glossaryRuleChapters.ts` - chapter wrappers for rule navigation.
- `src/components/Glossary/hooks/*` - `useGlossarySearch`, `useGlossaryModal`, `useGlossaryKeyboardNav`.
- `src/components/Glossary/spellGateChecker/*` - spell checks, issue summaries, and labels.
- `scripts/ingestPhbGlossary.ts`, `scripts/generateGlossaryIndex.js`, `scripts/bundle-static-data.ts` - source to index to bundle pipeline.
- `public/data/glossary/*` - generated index, entries, and bundle files.
- `src/components/Glossary/__tests__/Glossary.test.tsx`, `GlossaryDisplay.test.tsx` - behavior evidence.

## Integration Relationship
- `docs/projects/item_categorization` owns shared grouping intent and related data-contract gaps for Equipment and generated item metadata.
- `docs/tasks/glossary` is the broader planning area for glossary intent outside this UI-focused folder.
- `docs/projects/PROJECT_TRACKER.md` is the registry anchor and cross-project handoff point.

## Open Issues and Next Checks
- Confirm a non-dev rebuild contract for glossary index generation in standard build/CI paths.
- Decide whether Equipment grouping taxonomy should stay based on `itemType` strings or move to a curated canonical list.
- Validate whether all generated glossary fields consumed by UI, including `itemMetadata`, are consistently typed and preserved in all item pipelines.

## Resume Path
1. Read `TRACKER.md` for active tasks.
2. Read `GAPS.md` for durable unresolved items.
3. Verify the pipeline links with `PROJECT_TRACKER.md` and any relevant entries in `docs/tasks/glossary` and `docs/projects/item_categorization`.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

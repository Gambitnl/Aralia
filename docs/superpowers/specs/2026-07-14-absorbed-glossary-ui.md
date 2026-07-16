# Absorbed: Glossary UI (docs/projects/glossary-ui)

Absorbed into the planmap topic `glossary-structured-content` by the 2026-07 absorption wave.
The folder's git history is the archive; this doc keeps the still-live operational context.

## What this project was

The shipped glossary modal and content-browsing experience: `src/components/Glossary/*`,
glossary data loading, bundle/index generation, and game entry points that open glossary
links and initialize the modal.

## Rebuild pipeline (operational)

| Stage | Script | Input | Output |
|---|---|---|---|
| 1. Ingest | `scripts/ingestPhbGlossary.ts` | vendor 5eTools data | `public/data/glossary/entries/` |
| 2. Index | `scripts/generateGlossaryIndex.js` | entry files + spells manifest | `public/data/glossary/index/` |
| 3. Bundle | `scripts/bundle-static-data.ts` | index files via `main.json` | `public/data/glossary_bundle.json` |

- Full rebuild: `npm run glossary:rebuild` (ingest -> index -> bundle). `npm run build:data` delegates to it after item registry generation.
- Dev-server shortcut: `POST /api/glossary/rebuild-index` (Stage 2 only, via the `glossaryIndexManager` Vite plugin).

## Primary file map

- `src/components/Glossary/Glossary.tsx` — container modal, fetch lifecycle, open-to-term.
- `GlossarySidebar.tsx`, `GlossaryEntryPanel.tsx`, `GlossaryEntryTemplate.tsx`, `GlossaryContentRenderer.tsx`, `FullEntryDisplay.tsx` — tree, panes, render + term links.
- `hooks/useGlossarySearch.ts`, `hooks/useGlossaryModal.ts`, `hooks/useGlossaryKeyboardNav.ts`.
- `spellGateChecker/*` — spell checks and issue summaries invoked from `Glossary.tsx`.
- `glossaryRuleChapters.ts` — chapter wrappers for rule navigation.
- Data provider: `src/context/GlossaryContext.tsx` (reads `public/data/glossary_bundle.json`), `AppProviders.tsx`, `DataLoaderGate.tsx`, `GameModals.tsx`.

## Decision on record (D18, 2026-06-10, Remy)

Item metadata consumed by `GlossaryItemStatBlock` stays a **glossary-local, display-only
contract** (fields: `type`, `rarity`, `tier`, `reqAttune`, `cost`, `weight`, `damage`,
`properties`, `ac`). A shared ingest/registry schema is deferred. The `None` rarity
sentinel is hidden; cost renders as gp; missing fields are absent, not failures.
An ingestion guard shipped 2026-06-19 (`scripts/ingestPhbGlossary.ts` + `scripts/__tests__/ingestPhbGlossary.test.ts`).

## Open gaps carried into the planmap (as features on `glossary-structured-content`)

| Gap | Summary | Evidence |
|---|---|---|
| G2 | Equipment taxonomy uses raw source `itemType` labels; sync wording with item-categorization owners before changing grouping | `scripts/generateGlossaryIndex.js`, `scripts/ingestPhbGlossary.ts` |
| G4 | `spellGateBucketDetails.ts` split needs owner-routed planning (CMA-G2) before code movement | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts` |
| G5 | Rendering/registry large-file cluster split needs visual/test proof boundaries (CMA-G11) | `SpellGateBucketSections.tsx`, `IconRegistry.tsx`, `SpellCardTemplate.tsx` |
| G7 | `itemMetadata` built from `any` in ingest; optional typed builder/guard remains a follow-up | `scripts/ingestPhbGlossary.ts`, `src/types/ui.ts` |
| G8 | Spell detail prose needs live glossary term linking in the spell-detail render path | `SpellDetailPane.tsx`; routed 2026-06-26 from `docs/tasks/spell-system-overhaul/1B-SPELL-MIGRATION-ROADMAP.md` |

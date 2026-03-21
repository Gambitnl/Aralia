# Glossary

## Purpose

The Glossary domain is the app's read-only reference surface for rules, spells, classes, races, and related terms that can be opened without leaving the current gameplay flow.

## Verified Current Entry Points

High-signal current entry points verified in this pass:
- src/context/GlossaryContext.tsx
- src/components/Glossary/Glossary.tsx
- src/components/Glossary/FullEntryDisplay.tsx
- src/components/Glossary/SingleGlossaryEntryModal.tsx
- src/components/Glossary/SpellCardTemplate.tsx
- src/utils/glossaryUtils.ts

## Current Domain Shape

The live glossary flow is split across two layers:
- GlossaryContext.tsx loads and flattens glossary entries from public/data/glossary/index/main.json and nested index files.
- The UI lives under src/components/Glossary/, with the main modal, single-entry modal, spell-card presentation, tooltip helpers, search hooks, and navigation helpers.

Spell entries are a special case:
- Glossary.tsx uses useSpellGateChecks.
- When a spell entry is selected, the UI fetches its spell JSON from public/data/spells/level-*/<spell>.json.
- SpellCardTemplate.tsx renders that spell-specific data.

## Historical Drift Corrected

The older version of this file drifted in a few concrete ways:
- it treated src/data/glossaryData.ts as the glossary data-loading utility, but that file currently contains submap icon meanings rather than the live glossary loader
- it treated src/utils/glossaryUtils.ts as the primary utility surface without noting that the file is now a deprecated bridge that re-exports from src/utils/visuals/glossaryUtils
- it implied a cleaner ownership map than the current repo shape, where glossary state loading, entry rendering, spell data fetches, and icon-legend display now sit in related but distinct lanes

That older explanation should not be treated as the current implementation guide.

## Boundaries And Constraints

- The glossary is a read-only reference surface. It should help interpret game state, not become a second authority for mutating it.
- The live glossary entry index comes from public/data/glossary/, loaded through GlossaryContext.tsx.
- Spell entries remain coupled to the spell-data domain because the glossary fetches spell JSON from public/data/spells/.
- GlossaryDisplay.tsx still exists, but it is a narrower icon-legend surface rather than the main glossary architecture entry point.

## What Is Materially Implemented

This pass verified that the glossary domain already has:
- a context-driven glossary loader
- a main glossary modal
- a single-entry modal
- entry rendering and internal term-navigation helpers
- spell-specific glossary rendering
- tooltip and search/navigation helper surfaces under src/components/Glossary/

## Verified Test Surface

Verified tests in this pass:
- src/components/Glossary/__tests__/Glossary.test.tsx
- src/components/Glossary/__tests__/GlossaryDisplay.test.tsx
- src/components/__tests__/GlossaryContentRenderer.test.tsx
- src/components/__tests__/GlossaryFullEntryDisplay.test.tsx

The older claim about src/utils/__tests__/glossaryUtils.test.ts was not accurate in the current repo.

## Open Follow-Through Questions

- Should the deprecated src/utils/glossaryUtils.ts bridge be documented more explicitly alongside its newer src/utils/visuals/ home?
- Which docs should explain the split between the full glossary domain and the narrower icon-legend surfaces used by submap and related UI?
- How much spell-schema detail belongs in glossary docs versus the spell-domain reference docs?

---
schema_version: 1
project: Glossary UI
slug: glossary-ui
category: Feature/UI Projects
main_category: "Interface & Experience"
subcategory: Player UI Surfaces
status: active
last_updated: 2026-06-10
confidence: medium
evidence: docs/projects/glossary-ui
gap_signal: "open gaps remain; G3 decided 2026-06-10 (D18): item metadata stays glossary-local display-only"
protocol: living project doc set
next_step: "G3 decided 2026-06-10 (D18): item metadata stays a glossary-local display-only contract; shared ingest/registry schema deferred. Keep the documented field contract current; G7 (optional typed builder/guard) remains the adjacent follow-up."
agent_comments: ""
required_docs:
  - NORTH_STAR.md
  - TRACKER.md
  - GAPS.md
  - COLD_START_AGENT_PROMPT.md
  - DECISIONS.md
  - AUDIT_OR_PROOF.md
  - RUNBOOK.md
optional_docs:
  - tasks/
  - architecture notes
  - migration notes
required_verification:
  - docs_consistency
  - rebuild_verification
completed_verification:
  - docs_consistency
  - rebuild_verification
last_proof: 2026-06-09
workflow_gaps_reviewed: 2026-06-09
compaction_status: not_needed
lifecycle_status: active
deprecation_confidence: none
deprecation_reason: ""
canonical_owner: ""
human_decision_required: "no"
---
# Glossary UI North Star

Status: active (G3 decision recorded 2026-06-10; review gate cleared)
Last updated: 2026-06-10

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

## Glossary Rebuild Pipeline

The glossary system uses a three-stage pipeline. See `RUNBOOK.md` for detailed
commands and verification steps.

| Stage | Script | Input | Output |
|---|---|---|---|
| 1. Ingest | `scripts/ingestPhbGlossary.ts` | vendor 5eTools data | `public/data/glossary/entries/` |
| 2. Index | `scripts/generateGlossaryIndex.js` | entry files + spells manifest | `public/data/glossary/index/` |
| 3. Bundle | `scripts/bundle-static-data.ts` | index files via `main.json` | `public/data/glossary_bundle.json` |

Non-dev rebuild: `npm run glossary:rebuild` now runs the full ingest -> index ->
bundle flow. `npm run build:data` still handles the broader data build and now
delegates to the glossary rebuild after item registry generation. See G1 in
`GAPS.md` for the resolved proof path.

Dev-server shortcut: `POST /api/glossary/rebuild-index` triggers Stage 2 via the `glossaryIndexManager` Vite plugin.

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

## Required Review Brief

Title: Generated item metadata contract

Question: Should the item metadata consumed by `GlossaryItemStatBlock` remain a glossary-local display contract, or should it be promoted into a shared typed schema for both glossary rendering and item registry generation?

Issue: `scripts/ingestPhbGlossary.ts` emits `itemMetadata` from source item fields, `src/components/Glossary/GlossaryItemStatBlock.tsx` renders those fields directly, and `scripts/generateItemRegistry.ts` consumes overlapping metadata for the gameplay item registry. The surface is intentionally small, but future additions can drift if no owner is named.

Current behavior: the UI expects `type`, `rarity`, `tier`, `reqAttune`, `cost`, `weight`, `damage`, `properties`, and `ac`. `GlossaryItemStatBlock` hides the `None` rarity sentinel, renders cost as gp, and treats missing fields as absent rather than failing the card.

Why blocked: without a single owner, future metadata additions can be made in ingest or registry code without a matching render update.

Option A: keep the glossary-local display contract here, document the allowed fields explicitly, and leave registry conversion independent.

Option B: promote a shared typed item metadata contract that both the glossary and the item registry import.

Evidence: `scripts/ingestPhbGlossary.ts`, `scripts/generateItemRegistry.ts`, `src/components/Glossary/GlossaryItemStatBlock.tsx`, `src/components/Glossary/GlossaryEntryTemplate.tsx`, `src/types/ui.ts`.

Decision owner: human/product owner for glossary and item metadata boundaries.

Proof after decision: refresh this brief, update the tracker and gaps, and add a narrow contract test or proof note if the owner chooses a shared schema.

### Decision (2026-06-10)

Resolved by Remy (project owner) in the 2026-06-10 batched decision session (D18 in
`docs/projects/DECISION_BLITZ_2026-06-10.md`):

- **Option A — item metadata stays glossary-local.** The `itemMetadata` consumed by
  `GlossaryItemStatBlock` remains a glossary-local, display-only contract with the
  allowed fields documented here; registry conversion stays independent.
- **A shared ingest/registry schema is deferred** — no shared typed contract is promoted
  this cycle. No contract test is required by this decision (the shared-schema proof path
  only applied to Option B); G7's optional typed builder/guard remains an adjacent follow-up.

Status: decision recorded 2026-06-10; the G3 review gate is cleared.

## Open Issues and Next Checks
- Keep the named `npm run glossary:rebuild` entry point in sync if the pipeline stages change again.
- Decide whether Equipment grouping taxonomy should stay based on `itemType` strings or move to a curated canonical list.
- Decide whether generated item metadata stays glossary-local display data or moves into a shared typed schema. (Decided 2026-06-10, D18: stays glossary-local display-only; shared schema deferred.)
- Validate whether all generated glossary fields consumed by UI, including `itemMetadata`, are consistently typed and preserved in all item pipelines.

## Current Focus
- T2 is done: the non-dev rebuild contract is now captured in `RUNBOOK.md`, and the full glossary rebuild has a named `npm run glossary:rebuild` entry point.
- T3 is now review-required: the item metadata render contract is documented, but ownership for future schema additions still needs a human/product decision. (Update 2026-06-10: decided — D18, Option A — the contract stays glossary-local display-only and the shared schema is deferred; T3 closes against that decision.)
- Keep the item-categorization boundary: this folder records the dependency, but `docs/projects/item_categorization` owns the taxonomy decision.

## Resume Path
1. Read `TRACKER.md` for active tasks.
2. Read `GAPS.md` for durable unresolved items.
3. Read `RUNBOOK.md` for the rebuild pipeline and verification.
4. Verify the pipeline links with `PROJECT_TRACKER.md` and any relevant entries in `docs/tasks/glossary` and `docs/projects/item_categorization`.

## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count

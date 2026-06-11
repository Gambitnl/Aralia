# Item Categorization Gap Registry
Status: review-required
Last updated: 2026-06-08

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## 1. Confirmed, Project-Scoped Gaps

1. **[Resolved: Type Drift Between Typing Surfaces]** `src/types/ui.d.ts` now exposes `itemMetadata` so the declaration and implementation surfaces match.
   - Impact: declaration-only consumers now see the same field that the glossary runtime already consumes.
   - Evidence: `src/types/ui.ts` and `src/types/ui.d.ts` both include `itemMetadata`; `GlossaryItemStatBlock.tsx` and its focused test now exercise the field in the UI.

2. **[Blocked: Item Grouping Semantics Awaiting Taxonomy Review]** `scripts/ingestPhbGlossary.ts` normalizes only `itemType` tags and currently does not preserve a separate `itemGroup`-driven grouping signal.
   - Impact: any intended sub-groupings tied to 5etools `itemGroup` are not explicit in generated category trees, and the project should not guess whether that signal becomes visible taxonomy or stays source-only.
   - Evidence: the vendor corpus includes `itemGroup` bundles in `vendor/5etools-src/data/items.json`, while the item ingestion logic builds `itemTags` from `itemType` values and fallback heuristics with no `itemGroup` mapping.
   - Classification: blocked_human_decision
   - Next action: resolve the Required Review Brief in `NORTH_STAR.md` before any implementation path is chosen.

3. **[Open: Mechanical Conversion Validation]** `generateItemRegistry.ts` maps raw item metadata into simplified `Item` fields using heuristics (for type, damage, and value/rarity shape).
   - Impact: downstream gameplay parity may diverge from source metadata without an explicit acceptance test.
   - Evidence: heuristic type mapping (`weapon/armor/accessory/...`) and token-based damage parsing in `scripts/generateItemRegistry.ts`.

4. **[Open: Source Coverage Ambiguity]** `generateItemRegistry.ts` reads both `public/data/glossary/entries/equipment` and `public/data/glossary/entries/magic_items`, but the magic-items directory is currently empty in checked files.
   - Impact: unclear if empty directory is expected in current scope or a silent assumption.
   - Evidence: file-count check returned 0 files in `public/data/glossary/entries/magic_items`.

5. **[Open: Duplicate Conversion Paths]** `src/utils/itemAdapter.ts` is an alternate `GlossaryEntry` -> `Item` path and is only exercised by `scripts/test_itemAdapter.ts`.
   - Impact: future edits may diverge from `generateItemRegistry.ts` if one path is treated as canonical and the other drifts.
   - Evidence: both converter and generated registry exist; adapter is currently separate from the merged `generatedGlossaryItems.ts`.

6. **[Open: Rebuild Command Contract]** There is no dedicated `package.json` script listed for running `scripts/generateGlossaryIndex.js`.
   - Impact: regeneration is possible via dev endpoint (`POST /api/glossary/rebuild-index`) or manual `node scripts/generateGlossaryIndex.js`, but runbooks are less explicit.
   - Evidence: `package.json` has `build:data` for item registry, while index rebuild endpoint is implemented in `vite.config.ts`.

## 2. Verified/Resolved Within This Project

7. **[Resolved: Equipment Grouping]** Equipment entries are now grouped by `itemType` into hierarchical buckets in `public/data/glossary/index/equipment.json`.
   - Evidence: inspected file has 30 top-level groups with no missing `itemType` tags across 810 Equipment entries.

8. **[Resolved: Registry Merge]** Generated glossary items flow into runtime item data via `ALL_ITEMS`.
   - Evidence: `scripts/generateItemRegistry.ts` emits `GENERATED_GLOSSARY_ITEMS`, and `src/data/items/index.ts` spreads them into `ALL_ITEMS`.

9. **[Resolved: Recursive Glossary Display]** The glossary UI path already supports nested parents and child expansion/search behavior.
   - Evidence: `GlossarySidebar.tsx`, `useGlossarySearch.ts`, and `buildGlossaryDisplayIndex` route recursion over `subEntries`.

## 3. Notes / Open Validation Flags

10. **[Uncertain: Group Taxonomy Consistency]** Group names currently mirror generated `itemType` values (including plurals and punctuation variants like "Treasure (Gemstone)").
   - If UX requires a strict canonical taxonomy, this should be normalized in a dedicated taxonomy table.

11. **[Open: `magic_items` Coverage Intent]** The empty `magic_items` directory may be transitional or stale; verify with project intent before leaving unchanged.
   - This remains parked behind the `itemGroup` taxonomy decision because the project should not split or rewrite generated corpora until the grouping contract is settled.

12. **[Routed: Generated Glossary Item Corpus Is Not Manual Modularization]** `src/data/items/generatedGlossaryItems.ts` is large, but it is generated/corpus output and should be handled through item/glossary generator policy rather than hand-splitting.
   - Impact: manual modularization could desynchronize generated item data from ingestion and registry rebuild expectations.
   - Evidence: `src/data/items/generatedGlossaryItems.ts`; `scripts/generateItemRegistry.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G7.
   - Next action: if file size becomes a build or review problem, define sharding in the item registry generator and document import compatibility.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | not_started | adjacent_follow_up | future agent | docs/projects/PROJECT_CARD_SCHEMA.md | schema normalization | Replace this seeded gap row with project-specific findings if any remain after the next bounded gap sweep | docs/agent-workflows/living-project-task-protocol/templates/GAPS.md | The workflow requires durable gaps to have a consistent table shape and evidence path | Perform a bounded gap sweep and either update this row or close it as no longer applicable | Updated GAPS.md and TRACKER.md agree on the project gap state |

## Classification Reference

| Classification | Use when |
|---|---|
| `in_scope_now` | The task cannot honestly complete without it. |
| `support_needed_now` | It is not the product task, but the task cannot move without it. |
| `adjacent_follow_up` | Useful and related, but not required for this slice. |
| `out_of_scope` | It should not be part of this project/task. |
| `blocked_human_decision` | A real owner/operator choice is needed. |
| `blocked_external_state` | Waiting on PR, CI, vendor, service, environment, or another person. |

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.

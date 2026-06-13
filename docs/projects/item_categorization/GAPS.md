# Item Categorization Gap Registry
Status: review-required
Last updated: 2026-06-12

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## 1. Confirmed, Project-Scoped Gaps

1. **[Blocked: Item Grouping Semantics Awaiting Taxonomy Review]** `scripts/ingestPhbGlossary.ts` normalizes only `itemType` tags and currently does not preserve a separate `itemGroup`-driven grouping signal.
   - Impact: any intended sub-groupings tied to 5etools `itemGroup` are not explicit in generated category trees, and the project should not guess whether that signal becomes visible taxonomy or stays source-only.
   - Evidence: the vendor corpus includes `itemGroup` bundles in `vendor/5etools-src/data/items.json`, while the item ingestion logic builds `itemTags` from `itemType` values and fallback heuristics with no `itemGroup` mapping.
   - Classification: blocked_human_decision
   - Next action: resolve the Required Review Brief in `NORTH_STAR.md` before any implementation path is chosen.

2. **[Open: Mechanical Conversion Validation]** `generateItemRegistry.ts` maps raw item metadata into simplified `Item` fields using heuristics (for type, damage, and value/rarity shape).
   - Impact: downstream gameplay parity may diverge from source metadata without an explicit acceptance test.
   - Evidence: heuristic type mapping (`weapon/armor/accessory/...`) and token-based damage parsing in `scripts/generateItemRegistry.ts`.

3. **[Open: Source Coverage Ambiguity]** `generateItemRegistry.ts` reads both `public/data/glossary/entries/equipment` and `public/data/glossary/entries/magic_items`, but the magic-items directory is currently empty in checked files.
   - Impact: unclear if empty directory is expected in current scope or a silent assumption.
   - Evidence: file-count check returned 0 files in `public/data/glossary/entries/magic_items`.

4. **[Open: Duplicate Conversion Paths]** `src/utils/itemAdapter.ts` is an alternate `GlossaryEntry` -> `Item` path and is only exercised by `scripts/test_itemAdapter.ts`.
   - Impact: future edits may diverge from `generateItemRegistry.ts` if one path is treated as canonical and the other drifts.
   - Evidence: both converter and generated registry exist; adapter is currently separate from the merged `generatedGlossaryItems.ts`.

5. **[Open: Rebuild Command Contract]** There is no dedicated `package.json` script listed for running `scripts/generateGlossaryIndex.js`.
   - Impact: regeneration is possible via dev endpoint (`POST /api/glossary/rebuild-index`) or manual `node scripts/generateGlossaryIndex.js`, but runbooks are less explicit.
   - Evidence: `package.json` has `build:data` for item registry, while index rebuild endpoint is implemented in `vite.config.ts`.

## 2. Notes / Open Validation Flags

6. **[Uncertain: Group Taxonomy Consistency]** Group names currently mirror generated `itemType` values (including plurals and punctuation variants like "Treasure (Gemstone)").
   - If UX requires a strict canonical taxonomy, this should be normalized in a dedicated taxonomy table.

7. **[Open: `magic_items` Coverage Intent]** The empty `magic_items` directory may be transitional or stale; verify with project intent before leaving unchanged.
   - This remains parked behind the `itemGroup` taxonomy decision because the project should not split or rewrite generated corpora until the grouping contract is settled.

8. **[Routed: Generated Glossary Item Corpus Is Not Manual Modularization]** `src/data/items/generatedGlossaryItems.ts` is large, but it is generated/corpus output and should be handled through item/glossary generator policy rather than hand-splitting.
   - Impact: manual modularization could desynchronize generated item data from ingestion and registry rebuild expectations.
   - Evidence: `src/data/items/generatedGlossaryItems.ts`; `scripts/generateItemRegistry.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G7.
   - Next action: if file size becomes a build or review problem, define sharding in the item registry generator and document import compatibility.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| IC-G2 | blocked | blocked_human_decision | Human/product taxonomy owner | Item Categorization | taxonomy review | Decide whether `itemGroup` becomes first-class grouping metadata or stays source-only. | `vendor/5etools-src/data/items.json`; `scripts/ingestPhbGlossary.ts`; `scripts/generateGlossaryIndex.js`; `scripts/generateItemRegistry.ts` | Forward implementation would change visible taxonomy and should not be guessed by an agent. | Resolve the Required Review Brief in `NORTH_STAR.md`. | Decision recorded in `DECISIONS.md` and follow-up implementation path chosen or explicitly deferred. |
| IC-G3 | open | support_needed_now | Item Categorization | Item registry generation | registry validation | Validate mechanical conversion heuristics in `generateItemRegistry.ts`. | `scripts/generateItemRegistry.ts` | Downstream gameplay parity may diverge from source metadata without acceptance tests. | Add or document acceptance checks for type, damage, value, and rarity conversions. | Targeted registry output proof or tests. |
| IC-G4 | open | adjacent_follow_up | Item Categorization | Glossary source coverage | source coverage review | Confirm whether empty `public/data/glossary/entries/magic_items` is expected or stale. | `public/data/glossary/entries/magic_items`; `scripts/generateItemRegistry.ts` | Empty source coverage can hide missing generated content or a deliberate scope boundary. | Verify project intent before changing generated corpora. | Note in tracker/decisions explaining expected empty state or adding the missing source path. |
| IC-G5 | open | adjacent_follow_up | Item Categorization | Item conversion ownership | converter ownership review | Resolve duplicate conversion paths between `src/utils/itemAdapter.ts` and `scripts/generateItemRegistry.ts`. | `src/utils/itemAdapter.ts`; `scripts/generateItemRegistry.ts`; `scripts/test_itemAdapter.ts` | Two converters can drift if one is canonical and the other remains separate. | Decide whether `itemAdapter` is compatibility helper, deprecated path, or canonical input. | Decision note plus one parity check if both paths stay alive. |
| IC-G6 | open | adjacent_follow_up | Glossary maintenance / Item Categorization | Glossary rebuild operations | runbook review | Document a canonical non-dev glossary-index rebuild command path. | `scripts/generateGlossaryIndex.js`; `vite.config.ts`; `package.json` | Regeneration is possible, but runbooks are less explicit without a stable command path. | Add or document a repeatable command outside the dev endpoint. | Runbook or package script reference with one scoped rebuild proof. |

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

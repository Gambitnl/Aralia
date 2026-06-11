# Glossary UI Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | in_scope_now | Worker | TRACKER.md T4 | T2 pipeline investigation | `npm run glossary:rebuild` now runs Stage 1 -> Stage 2 -> Stage 3, and `build:data` delegates to it after item registry generation. | `package.json`, `docs/projects/glossary-ui/RUNBOOK.md` | The glossary rebuild now has a named, non-dev entry point and the bundle refresh path is explicit. | None; keep the named rebuild path and proof notes synchronized if the pipeline changes again. | Verified on 2026-06-09 by running `npm run glossary:rebuild` and confirming `public/data/glossary_bundle.json` rewrote successfully. |
| G2 | not_started | adjacent_follow_up | Worker | `docs/projects/item_categorization` | docs/tasks scan | Equipment taxonomy uses source `itemType` labels directly, while category wording and normalization are still implementation-derived. | `scripts/generateGlossaryIndex.js`, `scripts/ingestPhbGlossary.ts`, `docs/projects/item_categorization/GAPS.md` | UX and search consistency can drift if taxonomy labels change in ingestion without glossary UI updates. | Sync wording rules with item-categorization owners before changing grouping behavior. | Confirm a shared canonical group naming decision and migration note. |
| G3 | done | blocked_human_decision | Worker | `TRACKER.md` T3 | Runtime docs scan | `itemMetadata` now has a source-backed render contract, but future additions still lack a single owner across ingest, registry, and glossary display. | `scripts/ingestPhbGlossary.ts`, `scripts/generateItemRegistry.ts`, `src/components/Glossary/GlossaryItemStatBlock.tsx`, `src/types/ui.ts`; `docs/projects/DECISION_BLITZ_2026-06-10.md` D18 | Type-driven rendering may miss or misrender metadata when upstream output shape changes or the contract expands without a matching render update. | Decided 2026-06-10 (Remy, D18, Option A): item metadata stays a glossary-local display-only contract; shared ingest/registry schema deferred. Keep the documented field contract current; G7 (typed builder/guard) stays the adjacent follow-up. | Decision recorded 2026-06-10; glossary-local contract documented in NORTH_STAR and AUDIT_OR_PROOF. |
| G4 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G2 | Code modularization audit routing | `spellGateBucketDetails.ts` is a large domain-dense glossary/spell-gate surface and needs owner-routed split planning before any code movement. | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G2 | Splitting this file without preserving mismatch contracts could lose audit intent and structured-vs-canonical evidence. | Define a glossary-owned split boundary for spell gate bucket details and route structured spell validation ownership before refactoring. | Focused tests still cover `SpellGateChecksPanel` and `useSpellGateChecks`; any split has a before/after proof note. |
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G11 | Code modularization audit routing | Glossary rendering and registry files are a second large-file cluster beyond the spell-gate details row. | `src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx`; `src/components/Glossary/IconRegistry.tsx`; `src/components/Glossary/SpellCardTemplate.tsx` | Registry/rendering splits need icon coverage and spell-card rendering proof, not just file-size cleanup. | Define glossary-owned visual/test proof boundaries before modularization. | Spell gate panel tests, icon registry coverage, and glossary UI smoke proof stay named in any split plan |
| G7 | not_started | adjacent_follow_up | Worker | `scripts/ingestPhbGlossary.ts` | Runtime docs scan | `itemMetadata` is still built from an `any` object in ingest, so the new source-backed contract is documented but not enforced. | `scripts/ingestPhbGlossary.ts`, `src/types/ui.ts`, `docs/projects/glossary-ui/NORTH_STAR.md` | Future metadata additions can still drift silently even when the render contract is documented. | Decide later whether to add a narrow typed builder or schema guard without widening the current task. | Confirm the contract note and a narrow sample item proof once a guard exists. |
| G6 | done | in_scope_now | Worker | TRACKER.md T2 | T2 pipeline investigation | `build:data` now runs `generateItemRegistry.ts` before `npm run glossary:rebuild`, so the glossary index step still occurs after item registry generation. | `package.json`, `docs/projects/glossary-ui/RUNBOOK.md` | The ordering concern is now safe for the current pipeline. Keep the note only if item-registry output ever begins feeding glossary inputs. | None; revisit only if the item registry starts writing to glossary paths. | Verified on 2026-06-09 by reading the new script order and re-running `npm run build:data`. |

## Classification Reference

- `in_scope_now`: required to complete a reliable handoff for current implemented behavior.
- `support_needed_now`: required dependency for safe continuation but owned partly outside this folder.
- `adjacent_follow_up`: useful for future work, but not required for this project to remain stable.
- `out_of_scope`: explicitly outside this project.
- `blocked_human_decision`: blocked by explicit owner choice.
- `blocked_external_state`: blocked by another team, build, or service dependency.

## Update Rules

- Keep each gap tied to evidence and a next proof/check.
- Link back to a global gap ID when this project imports one.
- If the current project should not own a gap, add or update the global gap tracker instead of keeping the gap here.
- Do not mark a gap done unless completion evidence is linked or summarized.
- Add dated testimony or status notes to an existing gap instead of opening duplicates.

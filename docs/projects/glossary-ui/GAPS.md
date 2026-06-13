# Glossary UI Gap Registry

Status: active
Last updated: 2026-06-10

Use this file for durable unresolved findings that are too important or too large to live only in the tracker and that genuinely belong to this project. Put cross-project, orphaned, or out-of-current-scope gaps in the global gap tracker instead.
## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G2 | not_started | adjacent_follow_up | Worker | `docs/projects/item_categorization` | docs/tasks scan | Equipment taxonomy uses source `itemType` labels directly, while category wording and normalization are still implementation-derived. | `scripts/generateGlossaryIndex.js`, `scripts/ingestPhbGlossary.ts`, `docs/projects/item_categorization/GAPS.md` | UX and search consistency can drift if taxonomy labels change in ingestion without glossary UI updates. | Sync wording rules with item-categorization owners before changing grouping behavior. | Confirm a shared canonical group naming decision and migration note. |
| G4 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G2 | Code modularization audit routing | `spellGateBucketDetails.ts` is a large domain-dense glossary/spell-gate surface and needs owner-routed split planning before any code movement. | `src/components/Glossary/spellGateChecker/spellGateBucketDetails.ts`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G2 | Splitting this file without preserving mismatch contracts could lose audit intent and structured-vs-canonical evidence. | Define a glossary-owned split boundary for spell gate bucket details and route structured spell validation ownership before refactoring. | Focused tests still cover `SpellGateChecksPanel` and `useSpellGateChecks`; any split has a before/after proof note. |
| G5 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G11 | Code modularization audit routing | Glossary rendering and registry files are a second large-file cluster beyond the spell-gate details row. | `src/components/Glossary/spellGateChecker/SpellGateBucketSections.tsx`; `src/components/Glossary/IconRegistry.tsx`; `src/components/Glossary/SpellCardTemplate.tsx` | Registry/rendering splits need icon coverage and spell-card rendering proof, not just file-size cleanup. | Define glossary-owned visual/test proof boundaries before modularization. | Spell gate panel tests, icon registry coverage, and glossary UI smoke proof stay named in any split plan |
| G7 | not_started | adjacent_follow_up | Worker | `scripts/ingestPhbGlossary.ts` | Runtime docs scan | `itemMetadata` is still built from an `any` object in ingest, so the new source-backed contract is documented but not enforced. | `scripts/ingestPhbGlossary.ts`, `src/types/ui.ts`, `docs/projects/glossary-ui/NORTH_STAR.md` | Future metadata additions can still drift silently even when the render contract is documented. | Decide later whether to add a narrow typed builder or schema guard without widening the current task. | Confirm the contract note and a narrow sample item proof once a guard exists. |

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

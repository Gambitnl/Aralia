# Submap Living Tracker

Status: active
Last updated: 2026-06-10

## Status Vocabulary

- `not_started`
- `active`
- `waiting`
- `blocked`
- `done`
- `superseded`
- `out_of_scope`
- `reference_only`
- `extraction_active`

## Active Task Queue

| ID | Status | Task | Owner | Last updated | Evidence | Next action | Next check/proof |
|---|---|---|---|---|---|---|---|
| T1 | done | Create initial living-project scaffold for Submap UI. | Worker B / Codex integration pass | 2026-05-31 | `docs/projects/PROJECT_TRACKER.md`, `src/components/Submap` | Keep this folder scoped to Submap UI. | Three protocol files exist under `docs/projects/submap/`. |
| T2 | done | Finish Submap cold-start docs with contract-aware state/integration map. | Codex | 2026-06-08 | `docs/projects/submap/NORTH_STAR.md`, `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Keep the contract note aligned with the source surfaces. | `git diff --check` passed for the doc refresh. |
| T3 | extraction_active | Extract quick-travel and inspect contracts before component deprecation. | Cursor / Composer | 2026-06-10 | `src/utils/spatial/submapActionContracts.ts`, `src/utils/spatial/__tests__/submapActionContracts.test.ts`, `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Wire `SubmapPane` through shared contract helpers without behavior drift (G7). | SubmapPane dispatch paths use `submapActionContracts`; existing handler tests still pass. |
| T4 | extraction_active | Inventory all Submap dependents and classify retain/extract/replace/retire. | Cursor / Composer | 2026-06-10 | `docs/projects/submap/DEPENDENCY_CONTRACT.md` extraction matrix, `rg` inventory 2026-06-10 | Validate matrix rows against any newly discovered callers; route open replace rows to G5. | Every primary dependent surface has class + owner + proof path in matrix. |
| T5 | extraction_active | Split generation rules into reusable candidates before deprecating Submap components. | Cursor / Composer | 2026-06-10 | `docs/projects/submap/GENERATION_MODULARIZATION.md`, `src/hooks/useSubmapProceduralData.ts` | Extract `generateLocalTerrainData` as a non-React module (G8). | Fixture parity for plains/cave/wetland vs hook output. |
| T6 | done | Name the replacement local navigation surface after extraction evidence is ready. | human/product owner | 2026-06-10 | **Decision recorded 2026-06-10 (Remy, `docs/projects/DECISION_BLITZ_2026-06-10.md` D3 + campaign context section):** the Azgaar-continuation proc-gen submap system from the June 2026 campaign replaces the Submap; the G7/G8 extraction contracts + `DEPENDENCY_CONTRACT.md` are the inventory it must honor. Local record `DECISIONS.md` D-006. | Implementation lane open: replacement work proceeds in the campaign lane; Submap extraction (G7/G8) continues feeding the inventory. | Replacement proves contract coverage against DEPENDENCY_CONTRACT.md before component deprecation. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/GAPS.md` | protocol refresh | Define Submap UI contract for generated map outputs. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Keeps UI ownership distinct from generation internals. | Split into G2 and G3 with explicit scope. | G2 and G3 entries documented in `GAPS.md`. |
| G2 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/GAPS.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `submapActionContracts.ts`, contract tests, `DEPENDENCY_CONTRACT.md` | Prevents timing/encounter drift across map surfaces and preserves renderer-independent movement and inspection semantics. | Wire SubmapPane through `submapActionContracts` (G7). | Handler tests unchanged; contract tests remain green after wiring. |
| G3 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/GAPS.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `DEPENDENCY_CONTRACT.md` matrix, `rg` scan 2026-06-10 | Removal risk is unknown until all callers are classified. | Spot-check matrix against new `rg` hits; close replace rows only after G5. | Matrix covers 18 primary surfaces with owner routing. |
| G4 | active | support_needed_now | Cursor / Composer | `docs/projects/submap/GAPS.md` | generation modularization | Submap generation rules are mixed with React/UI projection and may be reusable elsewhere. | `GENERATION_MODULARIZATION.md`, `useSubmapProceduralData.ts` | CA/WFC/path/seeded-feature/biome/town logic could be lost or duplicated if treated as disposable UI code. | Extract `generateLocalTerrainData` per plan (G8). | Fixture parity for three biome families. |
| G5 | active | in_scope_now | June 2026 campaign (Azgaar-continuation proc-gen submap system) | `docs/projects/submap/GAPS.md` | replacement surface review | Replacement surface for local navigation is not named. **Decided 2026-06-10:** Azgaar-continuation proc-gen submap system is the named replacement (DECISION_BLITZ D3, campaign context section). | `SubmapPane.tsx`, `Minimap.tsx`, `Town`, `systems/travel`, `docs/projects/DECISION_BLITZ_2026-06-10.md` | Extraction can proceed, but final component deprecation needs a target architecture. | Implementation lane open: replacement must honor the G7/G8 + DEPENDENCY_CONTRACT.md inventory. | Replacement implementation proves carried-forward behaviors and removal proof against the dependency contract. |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route generation-internal gaps to `docs/projects/submap-generation/`.

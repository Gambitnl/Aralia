# Submap Living Tracker

Status: active
Last updated: 2026-06-09

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
| T3 | extraction_active | Extract quick-travel and inspect contracts before component deprecation. | future extraction agent | 2026-06-09 | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts`, `src/types/actions.ts` | Create a UI-independent proof or helper boundary for retained payload semantics without deleting the existing UI. | Focused test or proof notes retained payload fields and handler behavior outside `SubmapPane`. |
| T4 | extraction_active | Inventory all Submap dependents and classify retain/extract/replace/retire. | future extraction agent | 2026-06-09 | `rg -n -e Submap -e submap -e QUICK_TRAVEL -e inspect_submap_tile src`; `docs/projects/submap/NORTH_STAR.md` | Turn the dependent-system snapshot into an evidence-backed matrix with owner/project routing. | Tracker and gap registry name every dependent area and next proof path. |
| T5 | extraction_active | Split generation rules into reusable candidates before deprecating Submap components. | future extraction agent | 2026-06-09 | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/submapVisuals.ts`; `src/services/cellularAutomataService.ts`; `src/services/wfcService.ts`; `src/services/villageGenerator.ts`; `docs/projects/submap-generation/NORTH_STAR.md` | Decide which generation logic can be lifted out of React/UI code and which belongs to town/world/map-generation owners. | Modularization plan or source patch preserves CA/WFC/path/seeded-feature behavior with focused proof. |
| T6 | blocked | Name the replacement local navigation surface after extraction evidence is ready. | human/product owner | 2026-06-09 | `src/components/Submap/SubmapPane.tsx`, `src/components/Minimap.tsx`, `src/components/Town`, `src/systems/travel`, `docs/projects/submap/DEPENDENCY_CONTRACT.md` | Keep open questions visible, but do not block extraction passes that only inventory or lift reusable contracts. | Replacement decision recorded after extraction inventory is complete enough to compare options. |

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/GAPS.md` | protocol refresh | Define Submap UI contract for generated map outputs. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Keeps UI ownership distinct from generation internals. | Split into G2 and G3 with explicit scope. | G2 and G3 entries documented in `GAPS.md`. |
| G2 | active | support_needed_now | future extraction agent | `docs/projects/submap/GAPS.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts` | Prevents timing/encounter drift across map surfaces and preserves renderer-independent movement and inspection semantics. | Extract or prove the payload semantics outside the UI component without deleting the current UI. | Focused quick-travel and inspect test or proof note survives with the same payload fields. |
| G3 | active | support_needed_now | future extraction agent | `docs/projects/submap/GAPS.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `rg -n -e Submap -e submap -e QUICK_TRAVEL -e inspect_submap_tile src`; `docs/projects/submap/NORTH_STAR.md` | Removal risk is unknown until action menu, compass, minimap, materials, puzzles, town/village, generation, save/map, and design/tooling references are classified. | Create the dependent-system extraction matrix and route each row to an owner/project. | Matrix lists dependent surface, retained function, owner, and proof before deletion. |
| G4 | active | support_needed_now | future extraction agent | `docs/projects/submap/GAPS.md` | generation modularization | Submap generation rules are mixed with React/UI projection and may be reusable elsewhere. | `src/hooks/useSubmapProceduralData.ts`, `src/components/Submap/submapVisuals.ts`, `src/services/cellularAutomataService.ts`, `src/services/wfcService.ts`, `src/services/villageGenerator.ts` | CA/WFC/path/seeded-feature/biome/town logic could be lost or duplicated if treated as disposable UI code. | Split reusable generation candidates or write a source-backed modularization plan. | Focused proof shows extracted generation behavior or names exact candidate modules and tests. |
| G5 | blocked | blocked_human_decision | human/product owner | `docs/projects/submap/GAPS.md` | replacement surface review | Replacement surface for local navigation is not named. | `src/components/Submap/SubmapPane.tsx`, `src/components/Minimap.tsx`, `src/components/Town`, `src/systems/travel` | Extraction can proceed, but final component deprecation needs a target architecture. | Decide what replaces Submap after extraction evidence is ready. | Replacement decision names owner, carried-forward behaviors, and removal proof. |

## Update Rules

- Update this tracker before starting any significant feature-scoped slice.
- Keep active/blocked/waiting rows current with owner, date, and next proof.
- Route generation-internal gaps to `docs/projects/submap-generation/`.

# Submap Gap Registry

Status: active
Last updated: 2026-06-09

Use this file for durable unresolved findings that genuinely belong to Submap
UI, pre-deprecation extraction, and component ownership. The Submap surface is
not ready for deletion: first inventory dependents, extract retained functions,
and prove replacements. Route generation-internal evidence from the former
Submap Generation lane into this project unless it clearly belongs to a
separate world/town/navigation owner.

## Gap Log

| Gap ID | Status | Classification | Owner | Owning tracker/subsystem | Found during | Gap | Evidence/source | Why it matters | Next action | Next proof/check |
|---|---|---|---|---|---|---|---|---|---|---|
| G1 | done | adjacent_follow_up | Codex | `docs/projects/submap/TRACKER.md` | protocol refresh | UI contract for generated output was implicit and required formalization. | `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useSubmapProceduralData.ts` | Prevents UI from inventing assumptions about generated tile semantics. | Split into G2 and G3 with explicit payload/render ownership questions. | Confirm G2 and G3 tracked in `TRACKER.md`. |
| G2 | active | support_needed_now | future extraction agent | `docs/projects/submap/TRACKER.md` | contract extraction | Formalize and prove the quick-travel and inspect payload contract between Submap UI and action handler pipeline before component deprecation. | `docs/projects/submap/DEPENDENCY_CONTRACT.md`, `docs/projects/submap/AUDIT_OR_PROOF.md`, `src/components/Submap/SubmapPane.tsx`, `src/components/Submap/useQuickTravel.ts`, `src/types/actions.ts`, `src/hooks/actions/handleMovement.ts`, `src/hooks/actions/handleObservation.ts` | Avoids regressions in path duration, encounter timing, step delay behavior, and renderer-independent movement/inspection semantics. | Extract or prove the payload semantics outside the UI component without deleting the current UI. | Focused quick-travel and inspect test or proof note survives with the same payload fields. |
| G3 | active | support_needed_now | future extraction agent | `docs/projects/submap/TRACKER.md` | dependent-system inventory | All Submap dependents need retain/extract/replace/retire classification. | `rg -n -e Submap -e submap -e QUICK_TRAVEL -e inspect_submap_tile src`; `docs/projects/submap/NORTH_STAR.md` | Removal risk is unknown until action menu, compass, minimap, materials, puzzles, town/village, generation, save/map, and design/tooling references are classified. | Create the dependent-system extraction matrix and route each row to an owner/project. | Matrix lists dependent surface, retained function, owner, and proof before deletion. |
| G4 | active | support_needed_now | future extraction agent | `docs/projects/submap/TRACKER.md` | generation modularization | Submap generation rules are mixed with React/UI projection and may be reusable elsewhere. | `src/hooks/useSubmapProceduralData.ts`; `src/components/Submap/submapVisuals.ts`; `src/services/cellularAutomataService.ts`; `src/services/wfcService.ts`; `src/services/villageGenerator.ts` | CA/WFC/path/seeded-feature/biome/town logic could be lost or duplicated if treated as disposable UI code. | Split reusable generation candidates or write a source-backed modularization plan. | Focused proof shows extracted generation behavior or names exact candidate modules and tests. |
| G5 | blocked | blocked_human_decision | human/product owner | `docs/projects/submap/TRACKER.md` | replacement surface review | Replacement surface for local navigation is not named. | `src/components/Submap/SubmapPane.tsx`; `src/components/Minimap.tsx`; `src/components/Town`; `src/systems/travel` | Extraction can proceed, but final component deprecation needs a target architecture. | Decide what replaces Submap after extraction evidence is ready. | Replacement decision names owner, carried-forward behaviors, and removal proof. |
| G6 | not_started | adjacent_follow_up | Codex | `docs/projects/code-modularization-audit` CMA-G6 | Code modularization audit routing | `SubmapDoodadPainter.ts` is a large PIXI-backed painter (~817 lines) mixing 21 doodad-type draw methods, a texture cache, emoji-to-doodad mapping, and animation helpers. Submap is a phase-out surface, so painter extraction must preserve the draw-method contracts and texture-cache lifecycle without assuming the caller lives inside the current SubmapPane shell. | `src/components/Submap/painters/SubmapDoodadPainter.ts`; `src/components/Submap/painters/shared.ts`; `docs/projects/submap/DEPENDENCY_CONTRACT.md`; `docs/projects/code-modularization-audit/GAPS.md` CMA-G6 | If the painter is split before the dependent-system inventory (G3) is complete, extracted draw helpers may be deleted or orphaned when the Submap surface is retired. Any split must be additive and prove the texture-cache lifecycle and biome-palette contract are preserved. | Keep this routing-only until G3 (dependent-system inventory) names which draw methods are retained elsewhere; then scope a narrow painter-path extraction with a before/after texture-cache proof. | Painter export map survives submap deprecation path; focused test or proof note shows draw-method output is unchanged after any split. |

## Update Rules

- Keep gaps tied to evidence and a next proof/check.
- Route out-of-project items to `docs/projects/GLOBAL_GAPS.md`.
- Route generation-internal items to `docs/projects/submap-generation/GAPS.md`.
